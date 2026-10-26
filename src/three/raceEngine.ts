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
  WALL_OFFSET,
  checkpointSample,
  curvatureAt,
  headingAt,
  projectOnTrack,
  projectOnTrackFull,
  roadHeightAt,
  roadSlopeAt,
  samples,
} from "./raceTrack";

export type RacePhase = "idle" | "countdown" | "racing" | "paused" | "finished";

/** Car centre may travel this far from the centreline before it hits a barrier. */
const LATERAL_LIMIT = WALL_OFFSET - 0.26 - CAR_HALF_WIDTH;

/** Two AI supercars share the grid with the player. */
export const AI_COUNT = 2;

export const CAR = {
  /** metres/second — 63 m/s ≈ 227 km/h. */
  maxSpeed: 63,
  /** Nitro tops out 25% above the natural top speed — a cap, not a rocket. */
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
  /** Full tank empties in 4 s of held boost. */
  nitroDrain: 1 / 4,
  /** Empty bottle refills over 6 s — the same window as the lockout. */
  nitroRegen: 1 / 6,
  /** Boost is disabled for this long once the tank runs dry. */
  nitroCooldown: 6,
  nitroLapBonus: 0.3,
  /** Speed lost while the car is sliding sideways. */
  slideDrag: 0.05,
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
  | { type: "crash"; strength: number };

/** Digital input, written by <RaceDirector/>'s keyboard listeners. */
export const raceInput = {
  throttle: 0,
  brake: 0,
  /** +1 = full left, -1 = full right. */
  steer: 0,
  handbrake: false,
  boost: false,
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
  /** Seconds left before the bottle can be used again after running dry. */
  nitroCooldown: 0,
  nitroLocked: false,
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
  countdown: 3,
  lapTimes: [] as number[],
};

/**
 * AI opponents.
 *
 * They are pure station-keeping actors on the same centreline polyline the
 * player is projected onto: each tick they look a short window ahead for the
 * sharpest curvature, brake to the corner speed it implies and advance their
 * index. That is ~30 table reads per car per frame — no rigid bodies, no
 * raycasts, and the state lives in flat typed arrays so nothing allocates.
 */
const AI_SKILL = [
  /** Quick: a clean lap plus nitro is needed to beat it. */
  { top: 60, accel: 13.5, latAccel: 16.5, line: 2.7 },
  /** Slower, drives the other side of the road so the pack reads as traffic. */
  { top: 56, accel: 11.5, latAccel: 13.2, line: -2.5 },
];

export const raceAi = {
  x: new Float32Array(AI_COUNT),
  y: new Float32Array(AI_COUNT),
  z: new Float32Array(AI_COUNT),
  heading: new Float32Array(AI_COUNT),
  speed: new Float32Array(AI_COUNT),
  indexFloat: new Float32Array(AI_COUNT),
  lap: new Float32Array(AI_COUNT),
  lateral: new Float32Array(AI_COUNT),
  progress: new Float32Array(AI_COUNT),
  finishTime: new Float32Array(AI_COUNT),
  finished: new Uint8Array(AI_COUNT),
  wobble: new Float32Array(AI_COUNT),
};

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
  nitroCooldown: 0,
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
  countdown: 3,
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

/** Parks the car on the start/finish line with a fresh tank of nitro. */
export function resetVehicle() {
  const o = 0;
  const tx = samples[o + 3];
  const tz = samples[o + 5];
  const horizontal = Math.hypot(tx, tz) || 1;
  const leftX = tz / horizontal;
  const leftZ = -tx / horizontal;
  const lateral = -2.2;
  vehicle.x = samples[o] + leftX * lateral;
  vehicle.z = samples[o + 2] + leftZ * lateral;
  vehicle.y = samples[o + 1];
  vehicle.heading = headingAt(0, 0);
  vehicle.velX = 0;
  vehicle.velZ = 0;
  vehicle.vLong = 0;
  vehicle.vLat = 0;
  vehicle.steer = 0;
  vehicle.nitro = 1;
  vehicle.nitroCooldown = 0;
  vehicle.boostFx = 0;
  vehicle.crashFx = 0;
  vehicle.hint = 0;
  vehicle.prevIndex = 0;
  vehicle.indexFloat = 0;
  vehicle.wrongWayTimer = 0;
  vehicle.longAccel = 0;
  vehicle.previousVLong = 0;
  vehicle.topSpeedKph = 0;
  vehicle.speedTotal = 0;
  vehicle.speedSamples = 0;
  vehicle.boosting = false;
  race.accumulator = 0;
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
  raceInput.boost = false;
  raceTelemetry.lapTimes = race.lapTimes;
  raceTelemetry.topSpeedKph = 0;
  raceTelemetry.bestLap = 0;
  raceTelemetry.lastLap = 0;
  raceTelemetry.lap = 1;
  raceTelemetry.crashFx = 0;
  raceTelemetry.nitroCooldown = 0;
  raceTelemetry.nitroLocked = false;
  resetAi();
  syncDrive();
}

/** 3 → 2 → 1 → GO! : the classic standing start. */
export function startRaceSequence() {
  resetVehicle();
  race.phase = "countdown";
  race.countdown = 3;
  race.countdownTimer = 0;
  raceTelemetry.phase = "countdown";
  raceTelemetry.countdown = 3;
  raceTelemetry.wrongWay = false;
  raceDrive.active = true;
  emit({ type: "phase", phase: "countdown" });
  emit({ type: "countdown", value: 3 });
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

/** Paints one opponent onto the centreline at `indexFloat` + `lateral`. */
function placeAi(car: number, indexFloat: number, lateral: number) {
  raceAi.indexFloat[car] = indexFloat;
  raceAi.lateral[car] = lateral;
  const index = (((Math.round(indexFloat) % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT) * 7;
  const tx = samples[index + 3];
  const tz = samples[index + 5];
  const horizontal = Math.hypot(tx, tz) || 1;
  raceAi.x[car] = samples[index] + (tz / horizontal) * lateral;
  raceAi.z[car] = samples[index + 2] + (-tx / horizontal) * lateral;
  raceAi.y[car] = samples[index + 1];
  raceAi.heading[car] = headingAt(Math.round(indexFloat), 0);
}

/** Two rows of two: one opponent alongside, one a row back. */
function resetAi() {
  for (let car = 0; car < AI_COUNT; car++) {
    const front = car === 0;
    placeAi(car, front ? 0 : SAMPLE_COUNT - 6, front ? 2.2 : -2.2);
    raceAi.speed[car] = 0;
    raceAi.lap[car] = 1;
    raceAi.progress[car] = 0;
    raceAi.finishTime[car] = 0;
    raceAi.finished[car] = 0;
    raceAi.wobble[car] = car * 2.1;
  }
}

/** One AI tick — only ever called while the race is actually running. */
function stepAi(dt: number) {
  const playerProgress = race.lap - 1 + vehicle.indexFloat / SAMPLE_COUNT;
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

    // Gentle rubber banding keeps the pack in sight without feeling scripted.
    const gap = playerProgress - (raceAi.lap[car] - 1 + index / SAMPLE_COUNT);
    if (gap > 0.05) target *= 1.06;
    else if (gap < -0.05) target *= 0.95;

    raceAi.speed[car] += MathUtils.clamp(target - raceAi.speed[car], -26 * dt, skill.accel * dt);

    let next = index + (raceAi.speed[car] / SEGMENT_LENGTH) * dt;
    if (next >= SAMPLE_COUNT) {
      next -= SAMPLE_COUNT;
      raceAi.lap[car] += 1;
      // Finish detected once; the car keeps circulating on a cool-down lap but
      // its race progress is frozen past the flag so the ranking stays honest.
      if (raceAi.lap[car] > TOTAL_LAPS && !raceAi.finished[car]) {
        raceAi.finished[car] = 1;
        raceAi.finishTime[car] = race.totalTime;
        raceAi.progress[car] = TOTAL_LAPS + 1.5;
      }
    }

    // Racing line: hold one side of the road with a slow sinusoidal weave.
    raceAi.wobble[car] += dt;
    const line = skill.line * 0.55 + Math.sin(raceAi.wobble[car] * 0.6) * skill.line * 0.45;
    raceAi.lateral[car] = MathUtils.damp(raceAi.lateral[car], line, 0.8, dt);

    raceAi.indexFloat[car] = next;
    const base = (Math.floor(next) % SAMPLE_COUNT) * 7;
    const blend = next - Math.floor(next);
    const tx = samples[base + 3];
    const tz = samples[base + 5];
    const horizontal = Math.hypot(tx, tz) || 1;
    raceAi.x[car] = samples[base] + (tz / horizontal) * raceAi.lateral[car];
    raceAi.z[car] = samples[base + 2] + (-tx / horizontal) * raceAi.lateral[car];
    raceAi.y[car] = roadHeightAt(Math.floor(next), blend);
    raceAi.heading[car] = headingAt(Math.floor(next), blend);
    if (!raceAi.finished[car]) raceAi.progress[car] = raceAi.lap[car] - 1 + next / SAMPLE_COUNT;
  }
}

function completeLap() {
  race.lastLap = race.lapTime;
  if (race.bestLap <= 0 || race.lastLap < race.bestLap) race.bestLap = race.lastLap;
  race.lapTimes.push(race.lastLap);
  vehicle.nitro = Math.min(1, vehicle.nitro + CAR.nitroLapBonus);
  const wasBest = race.bestLap === race.lastLap;
  emit({ type: "lap", lap: race.lap, lapTime: race.lastLap, best: wasBest });
  race.lapTime = 0;
  if (race.lap >= TOTAL_LAPS) {
    race.phase = "finished";
    raceTelemetry.phase = "finished";
    race.finishers = race.lap;
    raceInput.throttle = 0;
    raceInput.boost = false;
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
  // An empty bottle locks the boost out until the cooldown has expired.
  vehicle.nitroCooldown = Math.max(0, vehicle.nitroCooldown - h);
  const boosting =
    !locked && input.boost && vehicle.nitro > 0.02 && vehicle.nitroCooldown <= 0 && vLong > 1;
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
      if (strength > 0.22) emit({ type: "crash", strength });
    }
  }

  vehicle.y = roadHeightAt(probe.index, probe.blend);
  vehicle.indexFloat = probe.index + probe.blend;
  vehicle.curvature = probe.curvature;
  vehicle.slope = roadSlopeAt(probe.index, probe.blend);

  // ------------------------------------------------------------------ nitro
  if (boosting) {
    vehicle.nitro = Math.max(0, vehicle.nitro - CAR.nitroDrain * h);
    // Running the bottle dry costs a 6 s lockout; the tank refills over it.
    if (vehicle.nitro <= 0) vehicle.nitroCooldown = CAR.nitroCooldown;
  } else vehicle.nitro = Math.min(1, vehicle.nitro + CAR.nitroRegen * h);

  const along = vehicle.velX * probe.forwardX + vehicle.velZ * probe.forwardZ;
  const groundSpeed = Math.hypot(vehicle.velX, vehicle.velZ);
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
  raceTelemetry.progress = (race.lap - 1 + vehicle.indexFloat / SAMPLE_COUNT) / TOTAL_LAPS;
  raceTelemetry.topSpeedKph = vehicle.topSpeedKph;
  raceTelemetry.averageSpeedKph = vehicle.speedSamples ? vehicle.speedTotal / vehicle.speedSamples : 0;
  raceTelemetry.phase = race.phase;
  raceTelemetry.countdown = race.countdown;
  raceTelemetry.nitroCooldown = vehicle.nitroCooldown;
  raceTelemetry.nitroLocked = vehicle.nitroCooldown > 0;
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
      : race.lap - 1 + vehicle.indexFloat / SAMPLE_COUNT;
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
    const value = Math.max(0, Math.ceil(3 - race.countdownTimer));
    if (value !== race.countdown) {
      race.countdown = value;
      if (value > 0) emit({ type: "countdown", value });
    }
    race.accumulator += dt;
    let steps = 0;
    while (race.accumulator >= SUBSTEP && steps < 6) {
      integrate(SUBSTEP, true);
      race.accumulator -= SUBSTEP;
      steps += 1;
    }
    if (steps === 6) race.accumulator = 0;
    if (race.countdownTimer >= 3) {
      race.phase = "racing";
      race.countdown = 0;
      race.lapTime = 0;
      race.totalTime = 0;
      raceTelemetry.phase = "racing";
      emit({ type: "countdown", value: 0 });
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
  if (phase === "racing") stepAi(dt);
  syncDrive();
}

/**
 * The instant kick of a nitro bottle — called on the Shift key edge. A hard
 * impulse along the car's forward axis, capped by the remaining headroom to the
 * boost top speed, plus an immediate FOV punch.
 */
export function applyNitroImpulse() {
  if (race.phase !== "racing" && race.phase !== "countdown") return false;
  // An empty or locked out bottle ignores the Shift edge entirely.
  if (vehicle.nitro <= 0.02 || vehicle.nitroCooldown > 0) return false;
  const forwardX = -Math.sin(vehicle.heading);
  const forwardZ = -Math.cos(vehicle.heading);
  const headroom = Math.max(0, CAR.boostSpeed - vehicle.vLong);
  const kick = Math.min(headroom, CAR.boostSpeed * 0.3) + 2.6;
  vehicle.velX += forwardX * kick;
  vehicle.velZ += forwardZ * kick;
  vehicle.vLong += kick;
  vehicle.previousVLong = vehicle.vLong;
  vehicle.boostFx = 1;
  return true;
}

/** Teleports the car back onto the centreline — used by the track reset key. */
export function recoverVehicle() {
  const probe = projectOnTrackFull(vehicle.x, vehicle.z);
  vehicle.x = samples[probe.index * 7] + (probe.forwardZ * -probe.lateral);
  vehicle.z = samples[probe.index * 7 + 2] + (-probe.forwardX * -probe.lateral);
  vehicle.heading = headingAt(probe.index, probe.blend);
  vehicle.velX = 0;
  vehicle.velZ = 0;
  vehicle.vLong = 0;
  vehicle.vLat = 0;
  vehicle.previousVLong = 0;
  vehicle.hint = probe.index;
  vehicle.prevIndex = probe.index;
  vehicle.y = roadHeightAt(probe.index, probe.blend);
  syncDrive();
}
