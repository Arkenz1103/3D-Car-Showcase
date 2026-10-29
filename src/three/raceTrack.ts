// @ts-nocheck
/**
 * Circuit definition + static geometry builders for the street racing mode.
 *
 * The selected centerline is baked at setup time into a flat `Float32Array`;
 * race-frame physics only reads that table, so no `Vector3` / `Matrix4` is
 * allocated inside a `useFrame` callback.
 *
 * Axis conventions match the rest of the project: `+Y` is up and the vehicle
 * model faces `-Z` in its local space, so a transform with `rotation.y = yaw`
 * drives a "forward" vector of `(-sin(yaw), 0, -cos(yaw))`.
 */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { raceSession, setRaceMap as updateRaceMap, type RaceMapId } from "./raceSession";

/** Asphalt width of the drivable ribbon (metres). */
export const TRACK_WIDTH = 13.6;
export const TRACK_HALF_WIDTH = TRACK_WIDTH / 2;
/** Distance from the centreline to the inside face of the concrete barriers. */
export const WALL_OFFSET = TRACK_HALF_WIDTH + 1.35;
/** Half width of the normalised car body — used for barrier + gate sensors. */
export const CAR_HALF_WIDTH = 1.02;
/** Samples around the closed loop. 480 samples ≈ 1.9 m of arc per sample. */
export const SAMPLE_COUNT = 480;
export const CHECKPOINT_COUNT = 6;
export const TOTAL_LAPS = 3;

/** Component offsets inside the flat sample table. */
const PX = 0;
const PY = 1;
const PZ = 2;
const TX = 3;
const TY = 4;
const TZ = 5;
const PD = 6;
const STRIDE = 7;

/** Track centerlines, authored as separate routes at similar racing scale. */
const TRACK_LAYOUTS: Record<RaceMapId, [number, number, number][]> = {
  maranello: [
    [-120, 0, -150],
    [-60, 0, -150],
    [20, 0, -150],
    [110, 2, -110],
    [120, 4, -20],
    [60, 3, 40],
    [-20, 1.5, 30],
    [-60, 0, 90],
    [-140, -1.5, 70],
    [-160, -2.5, -30],
    [-240, 0, -150],
    [-180, 0, -150],
  ],
  riviera: [
    [-155, 0, -110],
    [-95, 0, -110],
    [-35, 0, -110],
    [-60, 1, -160],
    [45, 2, -155],
    [135, 3, -95],
    [155, 2, -10],
    [95, 1, 55],
    [15, 2, 35],
    [-45, 3, 105],
    [-135, 1, 115],
    [-185, 0, 25],
    [-270, 0, -110],
    [-210, 0, -110],
  ],
  alpine: [
    [-150, -2, -130],
    [-90, -2, -130],
    [-30, -2, -130],
    [-55, -1, -165],
    [40, 1, -145],
    [120, 4, -105],
    [150, 5, -25],
    [105, 3, 55],
    [25, 1, 25],
    [-25, -1, 105],
    [-115, -4, 125],
    [-185, -5, 55],
    [-170, -3, -35],
    [-270, -2, -130],
    [-210, -2, -130],
  ],
};

export let TRACK_LENGTH = 0;
export let SEGMENT_LENGTH = 0;

/** Flat table: `[x, y, z, tangentX, tangentY, tangentZ, arcLength] * SAMPLE_COUNT`. */
export const samples = new Float32Array(SAMPLE_COUNT * STRIDE);
const CURVATURE = new Float32Array(SAMPLE_COUNT);

function rebuildTrackTable(mapId: RaceMapId) {
  const curve = new CatmullRomCurve3(
    TRACK_LAYOUTS[mapId].map(([x, y, z]) => new Vector3(x, y, z)),
    true,
    "centripetal",
    0.5,
  );
  // The default 200 arc-length lookup divisions leave long/short track samples
  // (up to ~24% apart on these routes), which stretches road quads and drifts
  // the driving sensors. Use a denser lookup so the road ribbon stays uniform.
  curve.arcLengthDivisions = SAMPLE_COUNT * 8;
  const spaced = curve.getSpacedPoints(SAMPLE_COUNT);
  TRACK_LENGTH = curve.getLength();
  SEGMENT_LENGTH = TRACK_LENGTH / SAMPLE_COUNT;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const a = spaced[i];
    const b = spaced[i + 1];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dz = b.z - a.z;
    const length = Math.hypot(dx, dy, dz) || 1;
    dx /= length;
    dy /= length;
    dz /= length;
    const o = i * STRIDE;
    samples[o + PX] = a.x;
    samples[o + PY] = a.y;
    samples[o + PZ] = a.z;
    samples[o + TX] = dx;
    samples[o + TY] = dy;
    samples[o + TZ] = dz;
    samples[o + PD] = i * SEGMENT_LENGTH;
  }

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const a = i * STRIDE;
    const b = ((i + 1) % SAMPLE_COUNT) * STRIDE;
    const dot = samples[a + TX] * samples[b + TX] + samples[a + TZ] * samples[b + TZ];
    CURVATURE[i] = Math.acos(Math.min(1, Math.max(-1, dot))) / SEGMENT_LENGTH;
  }
}

/** Apply the selected route before the race scene and its physics are mounted. */
export function selectRaceTrack(mapId: RaceMapId) {
  if (!TRACK_LAYOUTS[mapId]) return false;
  updateRaceMap(mapId);
  rebuildTrackTable(mapId);
  return true;
}

rebuildTrackTable(raceSession.mapId);

/** Sample index (modulo) that hosts checkpoint `k`. Checkpoint 0 is start/finish. */
export function checkpointSample(k: number) {
  return Math.round((k * SAMPLE_COUNT) / CHECKPOINT_COUNT) % SAMPLE_COUNT;
}

export function sampleX(i: number) {
  return samples[(i % SAMPLE_COUNT) * STRIDE + PX];
}

export function sampleY(i: number) {
  return samples[(i % SAMPLE_COUNT) * STRIDE + PY];
}

export function sampleZ(i: number) {
  return samples[(i % SAMPLE_COUNT) * STRIDE + PZ];
}

/** Height of the road surface, interpolated between two neighbouring samples. */
export function roadHeightAt(index: number, blend: number) {
  const a = (index % SAMPLE_COUNT) * STRIDE;
  const b = ((index + 1) % SAMPLE_COUNT) * STRIDE;
  return samples[a + PY] + (samples[b + PY] - samples[a + PY]) * blend;
}

/**
 * Road grade (rise over run) at a point on the circuit: how steeply the surface
 * climbs per metre travelled. Drives the car's pitch so it leans into hills.
 */
export function roadSlopeAt(index: number, blend = 0) {
  const a = (index % SAMPLE_COUNT) * STRIDE;
  const b = ((index + 1) % SAMPLE_COUNT) * STRIDE;
  const tx = samples[a + TX] + (samples[b + TX] - samples[a + TX]) * blend;
  const ty = samples[a + TY] + (samples[b + TY] - samples[a + TY]) * blend;
  const tz = samples[a + TZ] + (samples[b + TZ] - samples[a + TZ]) * blend;
  const horizontal = Math.hypot(tx, tz) || 1;
  return ty / horizontal;
}

/**
 * Result of a track projection. A single shared instance is reused every frame
 * so the caller never allocates; read the fields immediately after the call.
 */
export const trackProbe = {
  /** Index of the sample the segment starts at. */
  index: 0,
  /** Position along that segment, 0..1. */
  blend: 0,
  /** Signed distance from the centreline (+ is the left hand side). */
  lateral: 0,
  /** Forward direction of the segment (normalised, horizontal). */
  forwardX: 1,
  forwardZ: 0,
  /** Road height under the projected point. */
  y: 0,
  /** Curvature preview (radians per metre) around the segment. */
  curvature: 0,
  distance: 0,
};

/**
 * Projects a world position onto the centreline polyline.
 *
 * @param hint   last known sample index — when >= 0 the search is limited to
 *               ±`window` samples, which turns the projection into ~40
 *               iterations per frame instead of a full 480 sample scan.
 * @param window sample radius around `hint`.
 */
export function projectOnTrack(x: number, z: number, hint = -1, window = 22) {
  let bestDistance = Infinity;
  let bestIndex = 0;
  let bestBlend = 0;
  const from = hint >= 0 ? hint - window : 0;
  const to = hint >= 0 ? hint + window : SAMPLE_COUNT - 1;

  for (let step = from; step <= to; step++) {
    const a = ((step % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
    const b = (a + 1) % SAMPLE_COUNT;
    const ao = a * STRIDE;
    const bo = b * STRIDE;
    const ax = samples[ao + PX];
    const az = samples[ao + PZ];
    const ex = samples[bo + PX] - ax;
    const ez = samples[bo + PZ] - az;
    const lengthSq = ex * ex + ez * ez;
    let t = lengthSq > 1e-9 ? ((x - ax) * ex + (z - az) * ez) / lengthSq : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (ax + ex * t);
    const dz = z - (az + ez * t);
    const distance = dx * dx + dz * dz;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = a;
      bestBlend = t;
    }
  }

  const o = bestIndex * STRIDE;
  // Left hand vector of the segment: left = (tangentZ, 0, -tangentX).
  const leftX = samples[o + TZ];
  const leftZ = -samples[o + TX];
  const horizontal = Math.hypot(leftX, leftZ) || 1;
  const nx = leftX / horizontal;
  const nz = leftZ / horizontal;
  const px = samples[o + PX];
  const pz = samples[o + PZ];

  trackProbe.index = bestIndex;
  trackProbe.blend = bestBlend;
  trackProbe.lateral = (x - px) * nx + (z - pz) * nz;
  trackProbe.forwardX = samples[o + TX] / (horizontal || 1);
  trackProbe.forwardZ = samples[o + TZ] / (horizontal || 1);
  trackProbe.y = roadHeightAt(bestIndex, bestBlend);
  trackProbe.curvature = curvatureAt(bestIndex);
  trackProbe.distance = Math.sqrt(bestDistance);
  return trackProbe;
}

/** Full (unhinted) projection — used on spawn, reset and after a long crash. */
export function projectOnTrackFull(x: number, z: number) {
  return projectOnTrack(x, z, -1);
}

/** Heading the car must adopt to follow the circuit at a given sample. */
export function headingAt(index: number, blend = 0) {
  const a = (index % SAMPLE_COUNT) * STRIDE;
  const b = ((index + 1) % SAMPLE_COUNT) * STRIDE;
  const fx = samples[a + TX] + (samples[b + TX] - samples[a + TX]) * blend;
  const fz = samples[a + TZ] + (samples[b + TZ] - samples[a + TZ]) * blend;
  // rotation.y = yaw maps the model's -Z axis onto (-sin, -cos).
  return Math.atan2(-fx, -fz);
}

/** Turn rate (rad/m) of the circuit around a sample — drives kerb placement. */
export function curvatureAt(index: number) {
  return CURVATURE[((index % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT];
}

const SCRATCH_QUATERNION = new Quaternion();
const SCRATCH_POSITION = new Vector3();
const SCRATCH_SCALE = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);

/**
 * Composes the transform of a fixture sitting on the circuit: position offset
 * laterally from the centreline, rotated so its local `-Z` follows the track.
 * Build time only — the scratch objects above are module level by design.
 */
export function sampleMatrix(
  index: number,
  lateral: number,
  yOffset: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  out: Matrix4,
) {
  const s = ((index % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
  const o = s * STRIDE;
  const leftX = samples[o + TZ];
  const leftZ = -samples[o + TX];
  const horizontal = Math.hypot(leftX, leftZ) || 1;
  SCRATCH_POSITION.set(
    samples[o + PX] + (leftX / horizontal) * lateral,
    samples[o + PY] + yOffset,
    samples[o + PZ] + (leftZ / horizontal) * lateral,
  );
  SCRATCH_QUATERNION.setFromAxisAngle(UP, Math.atan2(-samples[o + TX], -samples[o + TZ]));
  SCRATCH_SCALE.set(scaleX, scaleY, scaleZ);
  return out.compose(SCRATCH_POSITION, SCRATCH_QUATERNION, SCRATCH_SCALE);
}

function writeRibbon(
  positions: number[],
  uvs: number[],
  indices: number[],
  lateral: number,
  width: number,
  yOffset: number,
  vScale: number,
) {
  const base = positions.length / 3;
  const half = width / 2;
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const s = i % SAMPLE_COUNT;
    const o = s * STRIDE;
    const leftX = samples[o + TZ];
    const leftZ = -samples[o + TX];
    const horizontal = Math.hypot(leftX, leftZ) || 1;
    const nx = leftX / horizontal;
    const nz = leftZ / horizontal;
    const x = samples[o + PX];
    const y = samples[o + PY] + yOffset;
    const z = samples[o + PZ];
    const outer = lateral + half;
    const inner = lateral - half;
    const v = (i * SEGMENT_LENGTH) / vScale;
    positions.push(x + nx * outer, y, z + nz * outer, x + nx * inner, y, z + nz * inner);
    uvs.push(0, v, 1, v);
    if (i < SAMPLE_COUNT) {
      const a = base + i * 2;
      // Winding chosen so the surface normal points up (+Y).
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
}

function writeDashedCenterline(positions: number[], uvs: number[], indices: number[]) {
  const dashLengthSamples = 2;
  const dashStrideSamples = 8;
  const halfWidth = 0.07;
  for (let start = 0; start < SAMPLE_COUNT; start += dashStrideSamples) {
    const base = positions.length / 3;
    for (let step = 0; step <= dashLengthSamples; step++) {
      const sample = (start + step) % SAMPLE_COUNT;
      const offset = sample * STRIDE;
      const leftX = samples[offset + TZ];
      const leftZ = -samples[offset + TX];
      const horizontal = Math.hypot(leftX, leftZ) || 1;
      const nx = leftX / horizontal;
      const nz = leftZ / horizontal;
      const x = samples[offset + PX];
      const y = samples[offset + PY] + 0.018;
      const z = samples[offset + PZ];
      positions.push(x + nx * halfWidth, y, z + nz * halfWidth, x - nx * halfWidth, y, z - nz * halfWidth);
      const v = ((start + step) * SEGMENT_LENGTH) / 4;
      uvs.push(0, v, 1, v);
      if (step < dashLengthSamples) {
        const a = base + step * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
}

function ribbonGeometry(specs: { lateral: number; width: number; yOffset: number; vScale: number }[], centerDashes = false) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const spec of specs) writeRibbon(positions, uvs, indices, spec.lateral, spec.width, spec.yOffset, spec.vScale);
  if (centerDashes) writeDashedCenterline(positions, uvs, indices);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** The asphalt itself — one draw call for the whole circuit. */
export function buildRoadSurface() {
  return ribbonGeometry([{ lateral: 0, width: TRACK_WIDTH, yOffset: 0, vScale: 12 }]);
}

/** Painted edge lines plus the outer track-out line, merged into one geometry. */
export function buildRoadMarkings() {
  const inset = TRACK_HALF_WIDTH - 0.38;
  return ribbonGeometry([
    { lateral: inset, width: 0.2, yOffset: 0.012, vScale: 4 },
    { lateral: -inset, width: 0.2, yOffset: 0.012, vScale: 4 },
  ], true);
}

/** Continuous guard rail capping the barriers — also one draw call. */
export function buildGuardRail() {
  const offset = WALL_OFFSET - 0.16;
  return ribbonGeometry([
    { lateral: offset, width: 0.3, yOffset: 1.06, vScale: 6 },
    { lateral: -offset, width: 0.3, yOffset: 1.06, vScale: 6 },
  ]);
}

/** Sampling stride (in samples) for fixtures placed every `metres` of track. */
export function strideFor(metres: number) {
  return Math.max(1, Math.round(metres / SEGMENT_LENGTH));
}

/** Number of fixture slots when walking the loop every `metres`. */
export function slotsFor(metres: number) {
  return Math.floor(SAMPLE_COUNT / strideFor(metres));
}
