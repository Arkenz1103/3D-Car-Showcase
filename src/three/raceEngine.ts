// @ts-nocheck
/**
 * Arcade racing engine.
 *
 * Design notes:
 *  - The simulation lives in plain module level objects (no React state), so
 *    `<RaceDirector/>` can advance it 60+ times per second without ever
 *    triggering a React render of the canvas.
 *  - `<RaceHud/>` polls `raceTelemetry` from its own rAF loop and writes
 *    straight into DOM nodes, so the speedometer is smooth while React only
 *    re-renders on the rare, coarse events (countdown / lap / finish).
 *  - Track sensors are the station-keeping projection of the car onto the
 *    centreline polyline: one 40 sample search per frame gives the lateral
 *    offset (concrete barriers), the checkpoint crossings (lap sensors) and the
 *    road height, which replaces a full rigid-body physics world.
 *  - Nothing in the step function allocates: no `new Vector3`, no array
 *    literals, no closures — scratch values are module level.
 */
import { MathUtils } from "three";
import {
  CAR_HALF_WIDTH,
  CHECKPOINT_COUNT,
  SAMPLE_COUNT,
  SEGMENT_LENGTH,
  TOTAL_LAPS,
  TRACK_HALF_WIDTH,
  WALL_OFFSET,
  checkpointSample,
  curvatureAt,
  headingAt,
  projectOnTrack,
  roadHeightAt,
  roadSlopeAt,
  samples,
} from "./raceTrack";

export type RacePhase = "idle" | "countdown" | "racing" | "paused" | "finished";

/** Car centre may travel this far from the centreline before it hits a barrier. */
const LATERAL_LIMIT = WALL_OFFSET - 0.26 - CAR_HALF_WIDTH;
// Keep opponents' full body inside the asphalt even after a contact shunt.
const AI_LATERAL_LIMIT = Math.min(5.25, TRACK_HALF_WIDTH - CAR_HALF_WIDTH - 0.3);

/** Two AI supercars share the grid with the player. */
export const AI_COUNT = 2;

export const CAR = {
  /** metres/second — 63 m/s ≈ 227 km/h. */
  maxSpeed: 63,
  /** Turbo tops out 25% above the natural top speed — a cap, not a rocket. */
  boostSpeed: 63 * 1.25,
  boostAccel: 15.5,
  accel: 21,
  brakeDecel: 34,
  reverseSpeed: 11,
  rollResist: 3.2,
  drag: 0.0042,
  steerMax: 0.74,
  steerRate: 5.4,
  yawRateMax: 2.4,
  grip: 7.6,
  driftGrip: 1.7,
  /** A turbo press launches one short, finite boost burst. */
  turboDuration: 1.35,
  /** Slow, skill-earned charge: a full refill needs roughly ten clean seconds. */
  nitroRegen: 0.1,
  /** Stay within this lane window and keep slip controlled to earn charge. */
  precisionLineLimit: 4.8,
  precisionSlipLimit: 12,
  /** Light rolling loss from lateral scrub; keep normal cornering momentum. */
  slideDrag: 0.004,
};

/** Upper speed (km/h) of gears 1..7. */
const GEAR_BANDS = [0, 44, 82, 122, 162, 204, 250, 320];

const SUBSTEP = 1 / 120;

export interface RaceSummary {
  totalTime: number;
  bestLap: number;
  lastLap: number;
  lapTimes: number[];
  topSpeedKph: number;
  laps: number;
}

export type RaceEvent =
  | { type: "countdown"; value: number }
  | { type: "go" }
  | { type: "lap"; lap: number; lapTime: number; best: boolean }
  | { type: "finish"; summary: RaceSummary }
  | { type: "phase"; phase: RacePhase }
  | { type: "crash"; strength: number; source: "barrier" | "vehicle" }
  | { type: "opponentCrash"; strength: number };

/** Digital input, written by <RaceDirector/>'s keyboard listeners. */
export const raceInput = {
  throttle: 0,
  brake: 0,
  /** +1 = full left, -1 = full right. */
  steer: 0,
  handbrake: false,
};

/** Transform consumed by <VehicleModel/> once it runs in race mode. */
export const raceDrive = {
  active: false,
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  /** Visual front wheel angle in degrees. */
  steerDeg: 0,
  /** Wheel rotation rate in radians/second (sign carries the direction). */
  spinRate: 0,
  /** Ground speed in m/s — used for motion derived effects. */
  speed: 0,
  boosting: false,
  boostFx: 0,
  braking: false,
  handbraking: false,
  crashFx: 0,
};

/** Everything the HUD needs, refreshed once per frame. */
export const raceTelemetry = {
  speedKph: 0,
  topSpeedKph: 0,
  averageSpeedKph: 0,
  gear: 1,
  gearLabel: "1",
  rpm: 0,
  redline: false,
  nitro: 1,
  nitroActive: false,
  turboReady: true,
  boostFx: 0,
  lap: 1,
  laps: TOTAL_LAPS,
  lapTime: 0,
  lastLap: 0,
  bestLap: 0,
  totalTime: 0,
  position: 1,
  totalRacers: 1 + AI_COUNT,
  checkpoint: 0,
  checkpoints: CHECKPOINT_COUNT,
  nextCheckpoint: 1,
  progress: 0,
  wrongWay: false,
  crashFx: 0,
  drift: 0,
  handbraking: false,
  phase: "idle" as RacePhase,
  countdown: 5,
  lapTimes: [] as number[],
};

/**
 * AI opponents.
 *
 * They race around the selected circuit, but use independent, slowly changing
 * lateral lane choices rather than a single baked racing line. Each tick they
 * look ahead for curvature, brake to a safe corner speed and move smoothly
 * between lines. The state stays in flat typed arrays: no rigid bodies or
 * raycasts, and no per-frame object allocation.
 */
const AI_SKILL = [
  /** Quick: a clean lap plus a well-timed turbo burst is needed to beat it. */
  { top: 60, accel: 13.5, latAccel: 16.5, laneCenter: -1.8, laneSwing: 2.5 },
  /** Slower, takes a different changing line and leaves room for the pack. */
  { top: 56, accel: 11.5, latAccel: 13.2, laneCenter: 2.2, laneSwing: 2.4 },
];

export const raceAi = {
  x: new Float32Array(AI_COUNT),
  y: new Float32Array(AI_COUNT),
  z: new Float32Array(AI_COUNT),
  heading: new Float32Array(AI_COUNT),
  speed: new Float32Array(AI_COUNT),
  braking: new Uint8Array(AI_COUNT),
  startLinePassed: new Uint8Array(AI_COUNT),
  startIndex: new Float32Array(AI_COUNT),
  gridLap: new Float32Array(AI_COUNT),
  impact: new Float32Array(AI_COUNT),
  impactSide: new Float32Array(AI_COUNT),
  indexFloat: new Float32Array(AI_COUNT),
  lap: new Float32Array(AI_COUNT),
  lateral: new Float32Array(AI_COUNT),
  progress: new Float32Array(AI_COUNT),
  finishTime: new Float32Array(AI_COUNT),
  finished: new Uint8Array(AI_COUNT),
  wobble: new Float32Array(AI_COUNT),
};

const COLLISION_HALF_LENGTH = 2.25;
const COLLISION_HALF_WIDTH = 0.96;
const START_GRID_CLEARANCE = 7.5;
const START_GRID_ROW_SPACING = 6.4;
const PLAYER_GRID_LATERAL = -1.65;
const AI_GRID_LATERAL = 1.65;
const PLAYER_AI_CONTACT_LATCH = new Uint8Array(AI_COUNT);
let OPPONENT_CONTACT_LATCH = 0;
const CONTACT = { normalX: 0, normalZ: 0, penetration: 0 };

const vehicle = {
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  velX: 0,
  velZ: 0,
  vLong: 0,
  vLat: 0,
  steer: 0,
  nitro: 1,
  boostTimer: 0,
  crashEventCooldown: 0,
  boostFx: 0,
  crashFx: 0,
  hint: 0,
  prevIndex: 0,
  indexFloat: 0,
  curvature: 0,
  slope: 0,
  wrongWayTimer: 0,
  longAccel: 0,
  previousVLong: 0,
  topSpeedKph: 0,
  speedTotal: 0,
  speedSamples: 0,
  boosting: false,
};

const race = {
  phase: "idle" as RacePhase,
  countdown: 5,
  countdownTimer: 0,
  cpPassed: 0,
  lap: 1,
  lapTime: 0,
  totalTime: 0,
  lastLap: 0,
  bestLap: 0,
  lapTimes: [] as number[],
  accumulator: 0,
  finishers: 0,
  gridStartIndex: 0,
  gridLap: 0,
};

const listeners = new Set<(event: RaceEvent) => void>();

export function subscribeRace(listener: (event: RaceEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: RaceEvent) {
  for (const listener of listeners) listener(event);
}

export function racePhase() {
  return race.phase;
}

/** `mm:ss.mmm` — warm-up laps and the summary modal share this format. */
export function formatRaceTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0:00.000";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value - minutes * 60);
  const millis = Math.floor((value - Math.floor(value)) * 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function gearForSpeed(speedKph: number) {
  for (let gear = 1; gear < GEAR_BANDS.length; gear++) {
    if (speedKph < GEAR_BANDS[gear]) return gear;
  }
  return GEAR_BANDS.length - 1;
}

function startingGridIndex(row = 0) {
  const clearanceSamples = Math.max(1, Math.round(START_GRID_CLEARANCE / SEGMENT_LENGTH));
  const rowSamples = Math.round((row * START_GRID_ROW_SPACING) / SEGMENT_LENGTH);
  return (SAMPLE_COUNT - clearanceSamples - rowSamples + SAMPLE_COUNT) % SAMPLE_COUNT;
}

/** Stages the player behind the start stripe with a fully charged turbo. */
export function resetVehicle() {
  const gridIndex = startingGridIndex();
  const gridOffset = gridIndex * 7;
  const tx = samples[gridOffset + 3];
  const tz = samples[gridOffset + 5];
  const horizontal = Math.hypot(tx, tz) || 1;
  const leftX = tz / horizontal;
  const leftZ = -tx / horizontal;
  vehicle.x = samples[gridOffset] + leftX * PLAYER_GRID_LATERAL;
  vehicle.y = roadHeightAt(gridIndex, 0);
  vehicle.z = samples[gridOffset + 2] + leftZ * PLAYER_GRID_LATERAL;
  vehicle.heading = headingAt(gridIndex, 0);
  vehicle.velX = 0;
  vehicle.velZ = 0;
  vehicle.vLong = 0;
  vehicle.vLat = 0;
  vehicle.steer = 0;
  vehicle.nitro = 1;
  vehicle.boostTimer = 0;
  vehicle.crashEventCooldown = 0;
  vehicle.boostFx = 0;
  vehicle.crashFx = 0;
  vehicle.hint = gridIndex;
  vehicle.prevIndex = gridIndex;
  vehicle.indexFloat = gridIndex;
  vehicle.wrongWayTimer = 0;
  vehicle.longAccel = 0;
  vehicle.previousVLong = 0;
  vehicle.topSpeedKph = 0;
  vehicle.speedTotal = 0;
  vehicle.speedSamples = 0;
  vehicle.boosting = false;
  race.accumulator = 0;
  race.gridStartIndex = gridIndex;
  race.gridLap = 0;
  race.cpPassed = 0;
  race.lap = 1;
  race.lapTime = 0;
  race.totalTime = 0;
  race.lastLap = 0;
  race.bestLap = 0;
  race.lapTimes = [];
  race.finishers = 0;
  raceInput.throttle = 0;
  raceInput.brake = 0;
  raceInput.steer = 0;
  raceInput.handbrake = false;
  raceTelemetry.lapTimes = race.lapTimes;
  raceTelemetry.topSpeedKph = 0;
  raceTelemetry.bestLap = 0;
  raceTelemetry.lastLap = 0;
  raceTelemetry.lap = 1;
  raceTelemetry.crashFx = 0;
  raceTelemetry.turboReady = true;
  resetAi();
  syncDrive();
}

/** Stage the cars for the pre-race camera without starting the countdown. */
export function prepareRaceGrid() {
  resetVehicle();
  race.phase = "idle";
  race.countdown = 5;
  race.countdownTimer = 0;
  raceTelemetry.phase = "idle";
  raceTelemetry.countdown = 5;
  raceTelemetry.wrongWay = false;
  raceDrive.active = true;
  syncDrive();
}

/** Five-second start: red 5–3, yellow 2, green 1, then GO at T-0. */
export function startRaceSequence() {
  resetVehicle();
  race.phase = "countdown";
  race.countdown = 5;
  race.countdownTimer = 0;
  raceTelemetry.phase = "countdown";
  raceTelemetry.countdown = 5;
  raceTelemetry.wrongWay = false;
  raceDrive.active = true;
  emit({ type: "phase", phase: "countdown" });
  emit({ type: "countdown", value: 5 });
}

export function restartRace() {
  startRaceSequence();
}

/** Leaves the circuit (the car returns to the showroom turntable). */
export function abortRace() {
  race.phase = "idle";
  raceTelemetry.phase = "idle";
  raceTelemetry.wrongWay = false;
  raceTelemetry.speedKph = 0;
  raceTelemetry.rpm = 0;
  raceTelemetry.boostFx = 0;
  raceTelemetry.crashFx = 0;
  raceDrive.active = false;
  raceInput.throttle = 0;
  raceInput.brake = 0;
  raceInput.steer = 0;
  emit({ type: "phase", phase: "idle" });
}

export function pauseRace(paused: boolean) {
  if (paused && race.phase === "racing") {
    race.phase = "paused";
    raceInput.throttle = 0;
    raceInput.brake = 0;
    raceTelemetry.phase = "paused";
    emit({ type: "phase", phase: "paused" });
  } else if (!paused && race.phase === "paused") {
    race.phase = "racing";
    raceTelemetry.phase = "racing";
    emit({ type: "phase", phase: "racing" });
  }
}

/** Place an opponent smoothly between track samples at `indexFloat` + `lateral`. */
function placeAi(car: number, indexFloat: number, lateral: number) {
  const wrapped = ((indexFloat % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
  const safeLateral = MathUtils.clamp(lateral, -AI_LATERAL_LIMIT, AI_LATERAL_LIMIT);
  const sample = Math.floor(wrapped);
  const blend = wrapped - sample;
  const index = sample * 7;
  const nextIndex = ((sample + 1) % SAMPLE_COUNT) * 7;
  const tx = samples[index + 3] + (samples[nextIndex + 3] - samples[index + 3]) * blend;
  const tz = samples[index + 5] + (samples[nextIndex + 5] - samples[index + 5]) * blend;
  const horizontal = Math.hypot(tx, tz) || 1;
  const centerX = samples[index] + (samples[nextIndex] - samples[index]) * blend;
  const centerZ = samples[index + 2] + (samples[nextIndex + 2] - samples[index + 2]) * blend;
  raceAi.indexFloat[car] = wrapped;
  raceAi.lateral[car] = safeLateral;
  raceAi.x[car] = centerX + (tz / horizontal) * safeLateral;
  raceAi.z[car] = centerZ + (-tx / horizontal) * safeLateral;
  raceAi.y[car] = roadHeightAt(sample, blend);
  raceAi.heading[car] = headingAt(sample, blend);
}

function relativeRaceIndex(index: number, startIndex = race.gridStartIndex) {
  let relative = index - startIndex;
  if (relative < 0) relative += SAMPLE_COUNT;
  else if (relative >= SAMPLE_COUNT) relative -= SAMPLE_COUNT;
  return relative;
}

/** Stage a realistic two-column grid: two cars up front and the third behind. */
function resetAi() {
  OPPONENT_CONTACT_LATCH = 0;
  for (let car = 0; car < AI_COUNT; car++) {
    const row = car === 0 ? 0 : 1;
    const gridIndex = startingGridIndex(row);
    // Alternate sides as the rows recede: opponent left, player right, rival left.
    const gridLane = AI_GRID_LATERAL;
    placeAi(car, gridIndex, gridLane);
    raceAi.startIndex[car] = gridIndex;
    raceAi.speed[car] = 0;
    raceAi.braking[car] = 0;
    raceAi.startLinePassed[car] = 0;
    raceAi.gridLap[car] = 0;
    raceAi.impact[car] = 0;
    raceAi.impactSide[car] = 0;
    PLAYER_AI_CONTACT_LATCH[car] = 0;
    raceAi.lap[car] = 1;
    raceAi.progress[car] = 0;
    raceAi.finishTime[car] = 0;
    raceAi.finished[car] = 0;
    raceAi.wobble[car] = car * 2.1;
  }
}

/** One AI tick — only ever called while the race is actually running. */
function stepAi(dt: number) {
  const playerProgress = race.gridLap + relativeRaceIndex(vehicle.indexFloat) / SAMPLE_COUNT;
  for (let car = 0; car < AI_COUNT; car++) {
    const skill = AI_SKILL[car];
    const index = raceAi.indexFloat[car];
    const sample = ((Math.round(index) % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;

    // Corner anticipation: the sharpest curvature in the next few samples sets
    // the corner speed, so the opponent lifts before the apex instead of after.
    const lookahead = 4 + Math.round(raceAi.speed[car] * 0.3);
    let curvature = 0;
    for (let step = 2; step <= lookahead; step += 2) {
      const value = curvatureAt(sample + step);
      if (value > curvature) curvature = value;
    }
    const corner = Math.sqrt(skill.latAccel / Math.max(curvature, 0.0009));
    let target = Math.min(skill.top, corner);

    // Pace correction keeps the field within a credible racing distance without
    // teleporting anyone: trailing rivals can catch up, leaders ease off slightly.
    const gap = playerProgress - (raceAi.gridLap[car] + relativeRaceIndex(index, raceAi.startIndex[car]) / SAMPLE_COUNT);
    target *= 1 + MathUtils.clamp(gap * 0.55, -0.18, 0.18);

    const speedError = target - raceAi.speed[car];
    raceAi.impact[car] = Math.max(0, raceAi.impact[car] - dt * 2.8);
    raceAi.braking[car] = speedError < -0.08 || raceAi.impact[car] > 0.2 ? 1 : 0;
    raceAi.speed[car] += MathUtils.clamp(speedError, -26 * dt, skill.accel * dt);

    let next = index + (raceAi.speed[car] / SEGMENT_LENGTH) * dt;
    if (next >= SAMPLE_COUNT) next -= SAMPLE_COUNT;
    if (crossedCheckpoint(index, next, checkpointSample(0))) {
      if (raceAi.startLinePassed[car]) {
        raceAi.lap[car] += 1;
        // Finish detected once; the car keeps circulating on a cool-down lap
        // but its race progress stays frozen past the flag.
        if (raceAi.lap[car] > TOTAL_LAPS && !raceAi.finished[car]) {
          raceAi.finished[car] = 1;
          raceAi.finishTime[car] = race.totalTime;
          raceAi.progress[car] = TOTAL_LAPS + 1.5;
        }
      } else {
        // The first pass over the start stripe after the standing start is not
        // a completed lap; it merely crosses the line the grid was staged behind.
        raceAi.startLinePassed[car] = 1;
      }
    }
    if (crossedCheckpoint(index, next, Math.round(raceAi.startIndex[car]))) raceAi.gridLap[car] += 1;

    // Each rival roams a different, evolving lane instead of tracing a fixed
    // racing line. Course phase plus a slow time drift creates broad, smooth
    // line choices while keeping the cars inside the road and away from walls.
    raceAi.wobble[car] += dt;
    const coursePhase = (next / SAMPLE_COUNT) * Math.PI * 2;
    const laneChoice =
      skill.laneCenter +
      Math.sin(coursePhase * 2 + raceAi.wobble[car] * 0.16 + car * 1.7) * skill.laneSwing +
      Math.sin(coursePhase * 5 - raceAi.wobble[car] * 0.11 + car * 2.4) * 0.55;
    const line = MathUtils.clamp(laneChoice, -AI_LATERAL_LIMIT, AI_LATERAL_LIMIT);
    const lateral = MathUtils.clamp(
      MathUtils.damp(raceAi.lateral[car], line, 0.72, dt),
      -AI_LATERAL_LIMIT,
      AI_LATERAL_LIMIT,
    );
    placeAi(car, next, lateral);
    if (!raceAi.finished[car]) raceAi.progress[car] = raceAi.gridLap[car] + relativeRaceIndex(next, raceAi.startIndex[car]) / SAMPLE_COUNT;
  }
}

function overlapOnContactAxis(
  dx: number,
  dz: number,
  axisX: number,
  axisZ: number,
  forward1X: number,
  forward1Z: number,
  side1X: number,
  side1Z: number,
  forward2X: number,
  forward2Z: number,
  side2X: number,
  side2Z: number,
) {
  const radius =
    COLLISION_HALF_LENGTH *
      (Math.abs(forward1X * axisX + forward1Z * axisZ) + Math.abs(forward2X * axisX + forward2Z * axisZ)) +
    COLLISION_HALF_WIDTH *
      (Math.abs(side1X * axisX + side1Z * axisZ) + Math.abs(side2X * axisX + side2Z * axisZ));
  const overlap = radius - Math.abs(dx * axisX + dz * axisZ);
  if (overlap <= 0) return false;
  if (overlap < CONTACT.penetration) {
    CONTACT.penetration = overlap;
    CONTACT.normalX = axisX;
    CONTACT.normalZ = axisZ;
  }
  return true;
}

/** Oriented-box contact test in XZ; no rigid-body library or per-frame allocations. */
function findCarContact(x1: number, z1: number, heading1: number, x2: number, z2: number, heading2: number) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const forward1X = -Math.sin(heading1);
  const forward1Z = -Math.cos(heading1);
  const side1X = -Math.cos(heading1);
  const side1Z = Math.sin(heading1);
  const forward2X = -Math.sin(heading2);
  const forward2Z = -Math.cos(heading2);
  const side2X = -Math.cos(heading2);
  const side2Z = Math.sin(heading2);
  CONTACT.penetration = Infinity;
  if (!overlapOnContactAxis(dx, dz, forward1X, forward1Z, forward1X, forward1Z, side1X, side1Z, forward2X, forward2Z, side2X, side2Z)) return false;
  if (!overlapOnContactAxis(dx, dz, side1X, side1Z, forward1X, forward1Z, side1X, side1Z, forward2X, forward2Z, side2X, side2Z)) return false;
  if (!overlapOnContactAxis(dx, dz, forward2X, forward2Z, forward1X, forward1Z, side1X, side1Z, forward2X, forward2Z, side2X, side2Z)) return false;
  if (!overlapOnContactAxis(dx, dz, side2X, side2Z, forward1X, forward1Z, side1X, side1Z, forward2X, forward2Z, side2X, side2Z)) return false;
  const towardSecond = dx * CONTACT.normalX + dz * CONTACT.normalZ;
  if (towardSecond < 0) {
    CONTACT.normalX = -CONTACT.normalX;
    CONTACT.normalZ = -CONTACT.normalZ;
  } else if (Math.abs(towardSecond) < 1e-4) {
    CONTACT.normalX = forward1X;
    CONTACT.normalZ = forward1Z;
  }
  return true;
}

function applyAiImpact(car: number, normalX: number, normalZ: number, impulse: number, direction: number, strength: number) {
  const heading = raceAi.heading[car];
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const sideX = -Math.cos(heading);
  const sideZ = Math.sin(heading);
  const velocityX = raceAi.speed[car] * forwardX + normalX * impulse * direction;
  const velocityZ = raceAi.speed[car] * forwardZ + normalZ * impulse * direction;
  const along = velocityX * forwardX + velocityZ * forwardZ;
  const lateralKick = velocityX * sideX + velocityZ * sideZ;
  raceAi.speed[car] = MathUtils.clamp(along, 0, AI_SKILL[car].top) * (1 - strength * 0.18);
  raceAi.lateral[car] = MathUtils.clamp(raceAi.lateral[car] + lateralKick * 0.12, -LATERAL_LIMIT, LATERAL_LIMIT);
  raceAi.impact[car] = Math.max(raceAi.impact[car], strength);
  raceAi.impactSide[car] = Math.sign(lateralKick) || Math.sign(direction * (normalX * sideX + normalZ * sideZ)) || 1;
  raceAi.braking[car] = 1;
  placeAi(car, raceAi.indexFloat[car], raceAi.lateral[car]);
}

function resolvePlayerOpponentContacts() {
  for (let car = 0; car < AI_COUNT; car++) {
    const touching = findCarContact(vehicle.x, vehicle.z, vehicle.heading, raceAi.x[car], raceAi.z[car], raceAi.heading[car]);
    if (!touching) {
      PLAYER_AI_CONTACT_LATCH[car] = 0;
      continue;
    }

    const normalX = CONTACT.normalX;
    const normalZ = CONTACT.normalZ;
    if (!PLAYER_AI_CONTACT_LATCH[car]) {
      PLAYER_AI_CONTACT_LATCH[car] = 1;
      const aiForwardX = -Math.sin(raceAi.heading[car]);
      const aiForwardZ = -Math.cos(raceAi.heading[car]);
      const aiVelocityX = raceAi.speed[car] * aiForwardX;
      const aiVelocityZ = raceAi.speed[car] * aiForwardZ;
      const closingSpeed = Math.max(0, -((aiVelocityX - vehicle.velX) * normalX + (aiVelocityZ - vehicle.velZ) * normalZ));
      if (closingSpeed > 0.55) {
        const strength = MathUtils.clamp(closingSpeed / 22, 0.12, 1);
        const impulse = (closingSpeed * 1.08) / 1.92;
        vehicle.velX -= normalX * impulse;
        vehicle.velZ -= normalZ * impulse;
        vehicle.velX *= 1 - strength * 0.16;
        vehicle.velZ *= 1 - strength * 0.16;
        applyAiImpact(car, normalX, normalZ, impulse, 1, strength);
        vehicle.crashFx = Math.max(vehicle.crashFx, strength);
        if (strength > 0.3) {
          vehicle.nitro = 0;
          vehicle.boostTimer = 0;
          vehicle.boosting = false;
        }
        if (closingSpeed > 3.2 && vehicle.crashEventCooldown <= 0) {
          vehicle.crashEventCooldown = 0.65;
          emit({ type: "crash", strength, source: "vehicle" });
        }
      }
    }

    // Separate the bodies over a few simulation frames instead of allowing
    // them to interpenetrate or snapping either car to a new track sample.
    const correction = Math.min(CONTACT.penetration + 0.025, 0.75);
    vehicle.x -= normalX * correction * 0.52;
    vehicle.z -= normalZ * correction * 0.52;
    const aiSideX = -Math.cos(raceAi.heading[car]);
    const aiSideZ = Math.sin(raceAi.heading[car]);
    const sideCorrection = normalX * aiSideX + normalZ * aiSideZ;
    raceAi.lateral[car] = MathUtils.clamp(raceAi.lateral[car] + sideCorrection * correction * 0.52, -LATERAL_LIMIT, LATERAL_LIMIT);
    placeAi(car, raceAi.indexFloat[car], raceAi.lateral[car]);
  }
}

function resolveOpponentContact() {
  if (!findCarContact(raceAi.x[0], raceAi.z[0], raceAi.heading[0], raceAi.x[1], raceAi.z[1], raceAi.heading[1])) {
    OPPONENT_CONTACT_LATCH = 0;
    return;
  }
  const normalX = CONTACT.normalX;
  const normalZ = CONTACT.normalZ;
  if (!OPPONENT_CONTACT_LATCH) {
    OPPONENT_CONTACT_LATCH = 1;
    const firstForwardX = -Math.sin(raceAi.heading[0]);
    const firstForwardZ = -Math.cos(raceAi.heading[0]);
    const secondForwardX = -Math.sin(raceAi.heading[1]);
    const secondForwardZ = -Math.cos(raceAi.heading[1]);
    const velocity1X = raceAi.speed[0] * firstForwardX;
    const velocity1Z = raceAi.speed[0] * firstForwardZ;
    const velocity2X = raceAi.speed[1] * secondForwardX;
    const velocity2Z = raceAi.speed[1] * secondForwardZ;
    const closingSpeed = Math.max(0, -((velocity2X - velocity1X) * normalX + (velocity2Z - velocity1Z) * normalZ));
    if (closingSpeed > 0.55) {
      const strength = MathUtils.clamp(closingSpeed / 22, 0.12, 1);
      const impulse = (closingSpeed * 1.08) / 2;
      applyAiImpact(0, normalX, normalZ, impulse, -1, strength);
      applyAiImpact(1, normalX, normalZ, impulse, 1, strength);
      if (closingSpeed > 5) emit({ type: "opponentCrash", strength });
    }
  }

  const correction = Math.min(CONTACT.penetration * 0.52 + 0.025, 0.75);
  for (let car = 0; car < AI_COUNT; car++) {
    const direction = car === 0 ? -1 : 1;
    const sideX = -Math.cos(raceAi.heading[car]);
    const sideZ = Math.sin(raceAi.heading[car]);
    const sideCorrection = (normalX * sideX + normalZ * sideZ) * direction;
    raceAi.lateral[car] = MathUtils.clamp(raceAi.lateral[car] + sideCorrection * correction, -LATERAL_LIMIT, LATERAL_LIMIT);
    placeAi(car, raceAi.indexFloat[car], raceAi.lateral[car]);
  }
}

function completeLap() {
  race.lastLap = race.lapTime;
  if (race.bestLap <= 0 || race.lastLap < race.bestLap) race.bestLap = race.lastLap;
  race.lapTimes.push(race.lastLap);
  const wasBest = race.bestLap === race.lastLap;
  emit({ type: "lap", lap: race.lap, lapTime: race.lastLap, best: wasBest });
  race.lapTime = 0;
  if (race.lap >= TOTAL_LAPS) {
    race.phase = "finished";
    raceTelemetry.phase = "finished";
    race.finishers = race.lap;
    raceInput.throttle = 0;
    const summary: RaceSummary = {
      totalTime: race.totalTime,
      bestLap: race.bestLap,
      lastLap: race.lastLap,
      lapTimes: race.lapTimes.slice(),
      topSpeedKph: vehicle.topSpeedKph,
      laps: TOTAL_LAPS,
    };
    emit({ type: "finish", summary });
    emit({ type: "phase", phase: "finished" });
  } else {
    race.lap += 1;
  }
}

/**
 * True when the interval `(from, to]` (walking forward around the loop) covers
 * the sample `target`. At 300 km/h the car moves ~2.8 m per frame while
 * checkpoints sit ~130 m apart, so a single frame can never skip a gate.
 */
function crossedCheckpoint(from: number, to: number, target: number) {
  const forward = (to - from + SAMPLE_COUNT) % SAMPLE_COUNT;
  if (forward === 0 || forward > SAMPLE_COUNT / 2) return false;
  const targetDistance = (target - from + SAMPLE_COUNT) % SAMPLE_COUNT;
  return targetDistance > 0 && targetDistance <= forward;
}

function advanceRaceProgress() {
  const index = vehicle.indexFloat < 0 ? 0 : Math.round(vehicle.indexFloat) % SAMPLE_COUNT;
  const previous = vehicle.prevIndex;
  if (index !== previous) {
    if (crossedCheckpoint(previous, index, Math.round(race.gridStartIndex))) race.gridLap += 1;
    const expected = (race.cpPassed + 1) % CHECKPOINT_COUNT;
    if (crossedCheckpoint(previous, index, checkpointSample(expected))) {
      race.cpPassed = expected;
      if (expected === 0) completeLap();
    }
    vehicle.prevIndex = index;
  }
}

/**
 * One physics tick. `locked` freezes the controls (grid start / race over) while
 * still integrating drag so the car rolls to a halt naturally.
 */
function integrate(h: number, locked: boolean) {
  const input = raceInput;
  const throttle = locked ? 0 : input.throttle;
  const brake = locked ? (race.phase === "finished" ? 1 : 0) : input.brake;
  const handbrake = !locked && input.handbrake;
  const steerInput = locked ? 0 : input.steer;

  const speed = Math.hypot(vehicle.velX, vehicle.velZ);
  const forwardX = -Math.sin(vehicle.heading);
  const forwardZ = -Math.cos(vehicle.heading);
  const leftX = -Math.cos(vehicle.heading);
  const leftZ = Math.sin(vehicle.heading);

  let vLong = vehicle.velX * forwardX + vehicle.velZ * forwardZ;
  let vLat = vehicle.velX * leftX + vehicle.velZ * leftZ;

  // ---------------------------------------------------------------- steering
  const steerLimit = CAR.steerMax * (0.42 + 0.58 / (1 + speed * 0.05));
  vehicle.steer = MathUtils.damp(vehicle.steer, steerInput * steerLimit, CAR.steerRate, h);

  // ------------------------------------------------------------- powertrain
  // Q fires a finite burst; clean line-holding earns charge back directly.
  vehicle.crashEventCooldown = Math.max(0, vehicle.crashEventCooldown - h);
  vehicle.boostTimer = Math.max(0, vehicle.boostTimer - h);
  const boosting = !locked && vehicle.boostTimer > 0;
  vehicle.boosting = boosting;
  const topSpeed = boosting ? CAR.boostSpeed : CAR.maxSpeed;
  let force = 0;
  if (throttle > 0) {
    const taper = Math.pow(Math.max(0, 1 - vLong / topSpeed), 0.55);
    force += CAR.accel * (0.4 + 0.6 * taper) * (1 - taper * taper * 0.55) * throttle;
  }
  if (boosting) force += CAR.boostAccel;
  if (brake > 0) {
    force += vLong > 0.6 ? -CAR.brakeDecel * brake : -CAR.accel * 0.5 * brake;
  }
  if (handbrake) force -= 14;
  if (throttle === 0 && brake === 0 && !boosting) {
    // Engine braking: never overshoot past zero.
    const coast = Math.min(CAR.rollResist, Math.abs(vLong) / h);
    force -= Math.sign(vLong) * coast;
  }
  force -= CAR.drag * vLong * Math.abs(vLong);

  vLong += force * h;
  if (throttle === 0 && brake === 0 && !boosting && Math.abs(vLong) < 0.06) vLong = 0;
  vLong = MathUtils.clamp(vLong, -CAR.reverseSpeed, CAR.boostSpeed * 1.02);

  // ------------------------------------------------------------- yaw + slip
  const speedFactor = Math.min(1, speed / 9);
  const highSpeedDamp = 1 / (1 + Math.pow(speed / 64, 2) * 0.8);
  const yawRate =
    vehicle.steer * CAR.yawRateMax * speedFactor * highSpeedDamp * (vLong < -0.2 ? -1 : 1);
  vehicle.heading += yawRate * h;

  // Rebuild the world velocity in the OLD frame (the body has not turned yet),
  // then scrub the lateral component in the NEW frame. The residual is the slip
  // that makes a handbrake drift and keeps high speed cornering honest.
  vehicle.velX = forwardX * vLong + leftX * vLat;
  vehicle.velZ = forwardZ * vLong + leftZ * vLat;

  const nextForwardX = -Math.sin(vehicle.heading);
  const nextForwardZ = -Math.cos(vehicle.heading);
  const nextLeftX = -Math.cos(vehicle.heading);
  const nextLeftZ = Math.sin(vehicle.heading);
  let vLong2 = vehicle.velX * nextForwardX + vehicle.velZ * nextForwardZ;
  let vLat2 = vehicle.velX * nextLeftX + vehicle.velZ * nextLeftZ;
  vLat2 *= Math.exp(-(handbrake ? CAR.driftGrip : CAR.grip) * h);
  vLong2 *= 1 - Math.min(0.35, Math.abs(vLat2) * CAR.slideDrag * h * 8);
  vehicle.velX = nextForwardX * vLong2 + nextLeftX * vLat2;
  vehicle.velZ = nextForwardZ * vLong2 + nextLeftZ * vLat2;
  vehicle.vLong = vLong2;
  vehicle.vLat = vLat2;
  vehicle.longAccel = (vLong2 - vehicle.previousVLong) / Math.max(h, 1e-4);
  vehicle.previousVLong = vLong2;

  vehicle.x += vehicle.velX * h;
  vehicle.z += vehicle.velZ * h;

  // --------------------------------------------------------- barriers + road
  const probe = projectOnTrack(vehicle.x, vehicle.z, vehicle.hint, 20);
  if (probe.distance > 26) vehicle.hint = -1;
  else vehicle.hint = probe.index;

  const normalX = probe.forwardZ;
  const normalZ = -probe.forwardX;
  const lateral = probe.lateral;
  if (Math.abs(lateral) > LATERAL_LIMIT) {
    const side = lateral > 0 ? 1 : -1;
    const penetration = Math.abs(lateral) - LATERAL_LIMIT;
    vehicle.x -= normalX * side * penetration;
    vehicle.z -= normalZ * side * penetration;
    const outward = vehicle.velX * normalX * side + vehicle.velZ * normalZ * side;
    if (outward > 0) {
      vehicle.velX -= normalX * side * outward * 1.42;
      vehicle.velZ -= normalZ * side * outward * 1.42;
      vehicle.velX *= 0.94;
      vehicle.velZ *= 0.94;
      const strength = Math.min(1, outward / 16);
      if (strength > vehicle.crashFx) vehicle.crashFx = strength;
      if (strength > 0.18) {
        // Impacts cancel any burst and drain the reserve; clean driving earns it back.
        vehicle.nitro = 0;
        vehicle.boostTimer = 0;
        vehicle.boosting = false;
        if (vehicle.crashEventCooldown <= 0) {
          vehicle.crashEventCooldown = 0.55;
          emit({ type: "crash", strength, source: "barrier" });
        }
      }
    }
  }

  vehicle.y = roadHeightAt(probe.index, probe.blend);
  vehicle.indexFloat = probe.index + probe.blend;
  vehicle.curvature = probe.curvature;
  vehicle.slope = roadSlopeAt(probe.index, probe.blend);

  // ----------------------------------------------------------- turbo charge
  const along = vehicle.velX * probe.forwardX + vehicle.velZ * probe.forwardZ;
  const groundSpeed = Math.hypot(vehicle.velX, vehicle.velZ);
  const linePrecision = Math.max(0, 1 - Math.abs(probe.lateral) / CAR.precisionLineLimit);
  const slipPrecision = Math.max(0, 1 - Math.abs(vehicle.vLat) / CAR.precisionSlipLimit);
  const cleanDriving =
    !locked &&
    !boosting &&
    vehicle.crashFx < 0.08 &&
    groundSpeed > 8 &&
    along > 1.5 &&
    linePrecision > 0 &&
    slipPrecision > 0;
  if (cleanDriving && vehicle.nitro < 1) {
    const precisionBonus = 0.7 + 0.3 * linePrecision * slipPrecision;
    vehicle.nitro = Math.min(1, vehicle.nitro + CAR.nitroRegen * precisionBonus * h);
  }

  vehicle.topSpeedKph = Math.max(vehicle.topSpeedKph, groundSpeed * 3.6);
  vehicle.speedTotal += groundSpeed * 3.6;
  vehicle.speedSamples += 1;
  if (along < -1.5 && groundSpeed * 3.6 > 14) vehicle.wrongWayTimer += h;
  else vehicle.wrongWayTimer = 0;
}

/** Copies the simulation into the mesh transform + the HUD telemetry. */
function syncDrive() {
  const groundSpeed = Math.hypot(vehicle.velX, vehicle.velZ);
  const speedKph = groundSpeed * 3.6;

  raceDrive.x = vehicle.x;
  raceDrive.y = vehicle.y;
  raceDrive.z = vehicle.z;
  raceDrive.heading = vehicle.heading;
  raceDrive.pitch = MathUtils.clamp(
    Math.atan(vehicle.slope) * Math.cos(vehicle.heading - headingAt(vehicle.hint, 0)) +
      MathUtils.clamp(vehicle.longAccel * 0.0022, -0.045, 0.045),
    -0.32,
    0.32,
  );
  raceDrive.roll = MathUtils.clamp((vehicle.vLat * -0.018 + vehicle.vLong * vehicle.curvature * -0.55), -0.12, 0.12);
  raceDrive.steerDeg = MathUtils.clamp(vehicle.steer * 57.2958 * 1.35, -42, 42);
  raceDrive.spinRate = vehicle.vLong / 0.345;
  raceDrive.speed = groundSpeed;
  raceDrive.boosting = vehicle.boosting;
  raceDrive.braking = raceInput.brake > 0 && vehicle.vLong > 0.6;
  raceDrive.handbraking = raceInput.handbrake;
  raceDrive.boostFx = vehicle.boostFx;
  raceDrive.crashFx = vehicle.crashFx;

  raceTelemetry.speedKph = speedKph;
  raceTelemetry.gear = vehicle.vLong < -0.5 ? -1 : speedKph < 0.8 ? 0 : gearForSpeed(speedKph);
  raceTelemetry.gearLabel =
    raceTelemetry.gear < 0 ? "R" : raceTelemetry.gear === 0 ? "N" : String(raceTelemetry.gear);
  const band = Math.max(0, Math.min(GEAR_BANDS.length - 1, Math.max(raceTelemetry.gear, 1)));
  const bandLow = GEAR_BANDS[band - 1] ?? 0;
  const bandHigh = GEAR_BANDS[band] ?? 320;
  const bandRatio = MathUtils.clamp((speedKph - bandLow) / Math.max(1, bandHigh - bandLow), 0, 1);
  const revving =
    race.phase === "countdown" ? raceInput.throttle * 2400 : raceInput.throttle * 700 * (1 - bandRatio);
  raceTelemetry.rpm = MathUtils.clamp(1800 + bandRatio * 5500 + revving, 800, 8800);
  raceTelemetry.redline = raceTelemetry.rpm > 7800;
  raceTelemetry.nitro = vehicle.nitro;
  raceTelemetry.nitroActive = vehicle.boosting;
  raceTelemetry.boostFx = vehicle.boostFx;
  raceTelemetry.crashFx = vehicle.crashFx;
  raceTelemetry.drift = Math.abs(vehicle.vLat);
  raceTelemetry.lap = race.lap;
  raceTelemetry.lapTime = race.lapTime;
  raceTelemetry.totalTime = race.totalTime;
  raceTelemetry.lastLap = race.lastLap;
  raceTelemetry.bestLap = race.bestLap;
  raceTelemetry.checkpoint = race.cpPassed;
  raceTelemetry.nextCheckpoint = (race.cpPassed + 1) % CHECKPOINT_COUNT;
  raceTelemetry.wrongWay = vehicle.wrongWayTimer > 0.45;
  raceTelemetry.progress = (race.gridLap + relativeRaceIndex(vehicle.indexFloat) / SAMPLE_COUNT) / TOTAL_LAPS;
  raceTelemetry.topSpeedKph = vehicle.topSpeedKph;
  raceTelemetry.averageSpeedKph = vehicle.speedSamples ? vehicle.speedTotal / vehicle.speedSamples : 0;
  raceTelemetry.phase = race.phase;
  raceTelemetry.countdown = race.countdown;
  raceTelemetry.turboReady = vehicle.nitro >= 0.999;
  raceTelemetry.handbraking = raceInput.handbrake;
  computePosition();
}

/**
 * Where the player sits in the field: 1st when nobody is ahead, otherwise one
 * past the fastest opponent. Six comparisons per frame, zero allocation, and
 * it feeds the HUD's `POS:` readout.
 */
function computePosition() {
  // Once the player has taken the flag their progress sits just past the last
  // lap: still ahead of anyone racing, behind anyone who finished earlier.
  const mine =
    race.phase === "finished"
      ? TOTAL_LAPS + 0.5
      : race.gridLap + relativeRaceIndex(vehicle.indexFloat) / SAMPLE_COUNT;
  let ahead = 0;
  for (let car = 0; car < AI_COUNT; car++) {
    if (raceAi.progress[car] > mine) ahead += 1;
  }
  raceTelemetry.position = ahead + 1;
}

/** Advances the race. Call once per frame from <RaceDirector/>. */
export function stepRace(rawDelta: number) {
  const dt = MathUtils.clamp(rawDelta, 0, 0.05);
  const phase = race.phase;
  if (phase === "idle") return;

  // Boost/FOV smoothing runs on every active phase so the camera pulse eases out.
  const targetBoost = vehicle.boosting ? 1 : 0;
  vehicle.boostFx = MathUtils.damp(vehicle.boostFx, targetBoost, vehicle.boosting ? 7 : 3.4, dt);
  vehicle.crashFx = MathUtils.damp(vehicle.crashFx, 0, 3.6, dt);

  if (phase === "paused") {
    syncDrive();
    return;
  }

  if (phase === "countdown") {
    race.countdownTimer += dt;
    const value = Math.max(0, Math.ceil(5 - race.countdownTimer - 1e-6));
    if (value !== race.countdown) {
      race.countdown = value;
      emit({ type: "countdown", value });
    }
    race.accumulator += dt;
    let steps = 0;
    while (race.accumulator >= SUBSTEP && steps < 6) {
      integrate(SUBSTEP, true);
      race.accumulator -= SUBSTEP;
      steps += 1;
    }
    if (steps === 6) race.accumulator = 0;
    if (race.countdownTimer >= 5 - 1e-6) {
      // The green light holds for one full second; GO releases the cars at T-0.
      race.phase = "racing";
      race.countdown = 0;
      race.lapTime = 0;
      race.totalTime = 0;
      raceTelemetry.phase = "racing";
      emit({ type: "go" });
      emit({ type: "phase", phase: "racing" });
    }
    syncDrive();
    return;
  }

  if (phase === "racing") {
    race.lapTime += dt;
    race.totalTime += dt;
  }

  race.accumulator += dt;
  let steps = 0;
  const locked = phase === "finished";
  while (race.accumulator >= SUBSTEP && steps < 6) {
    integrate(SUBSTEP, locked);
    race.accumulator -= SUBSTEP;
    steps += 1;
  }
  if (steps === 6) race.accumulator = 0;

  if (phase === "racing") advanceRaceProgress();

  // Opponents only move while the lap clock is running; then syncDrive()
  // re-ranks the field so the HUD can print 1st..3rd.
  if (phase === "racing") {
    stepAi(dt);
    resolvePlayerOpponentContacts();
    resolveOpponentContact();
  }
  syncDrive();
}

/** One finite turbo burst, triggered by a single Q press while driving cleanly. */
export function activateTurbo() {
  if (race.phase !== "racing" || vehicle.nitro < 0.999) return false;
  if (vehicle.vLong < 2.5 || vehicle.wrongWayTimer > 0.15 || vehicle.crashFx >= 0.08) return false;
  vehicle.nitro = 0;
  vehicle.boostTimer = CAR.turboDuration;
  vehicle.boosting = true;
  const forwardX = -Math.sin(vehicle.heading);
  const forwardZ = -Math.cos(vehicle.heading);
  const headroom = Math.max(0, CAR.boostSpeed - vehicle.vLong);
  const kick = Math.min(headroom, CAR.boostSpeed * 0.08) + 1.5;
  vehicle.velX += forwardX * kick;
  vehicle.velZ += forwardZ * kick;
  vehicle.vLong += kick;
  vehicle.previousVLong = vehicle.vLong;
  vehicle.boostFx = 1;
  syncDrive();
  return true;
}
