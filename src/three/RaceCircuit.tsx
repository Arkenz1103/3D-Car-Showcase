// @ts-nocheck
/**
 * Static street circuit renderer.
 *
 * Performance strategy
 *  - Each selectable route is baked once into a module-level cache (geometries,
 *    instance matrices, textures) and reused on replay, avoiding per-race rebuilds.
 *  - Repeated fixtures — barriers, street lamps, checkpoint pillars, skyline —
 *    are single `instancedMesh` draw calls sharing one geometry + material, and
 *    keep their computed bounding spheres so frustum culling still discards the
 *    off-screen batches.
 *  - Only two real point lights exist: they are pooled and snapped to the
 *    nearest lamp heads, reducing fragment-lighting cost on weaker GPUs.
 *  - The road, markings and guard rail are one merged ribbon each; every static
 *    mesh opts out of raycasting (`raycast={() => null}`).
 */
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Vector3,
} from "three";
import {
  makeAsphaltTextures,
  makeChequerTexture,
  makeDaySkyTexture,
  makeGroundTexture,
  makeGlowTexture,
  makeRainStreakTexture,
  makeSignTexture,
  makeSkyTexture,
  makeStormSkyTexture,
} from "./raceAssets";
import { raceDrive } from "./raceEngine";
import { currentEnv, raceSession, subscribeRaceSession } from "./raceSession";
import { markShadowsDirty } from "./sceneMotion";
import {
  CHECKPOINT_COUNT,
  TRACK_WIDTH,
  WALL_OFFSET,
  buildGuardRail,
  buildRoadMarkings,
  buildRoadSurface,
  checkpointSample,
  sampleMatrix,
  selectRaceTrack,
  slotsFor,
} from "./raceTrack";

const BARRIER_STRIDE = 2;
const LAMP_STRIDE = 18;
const LIGHT_POOL = 2;
const LAMP_HEIGHT = 7.4;

/**
 * Rain volume: a single point cloud that rides along with the car. One buffer,
 * one draw call, and the streaks are recycled inside a fixed box (falling past
 * the floor wraps them to the top) instead of being respawned — so a long race
 * never allocates a particle.
 */
const RAIN_COUNT = 700;
const RAIN_AREA = 44;
const RAIN_HEIGHT = 26;

function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bakes a list of instance transforms into a transferable `Float32Array`. */
function fillMatrices(count: number, write: (index: number, matrix: Matrix4) => void) {
  const data = new Float32Array(count * 16);
  const matrix = new Matrix4();
  for (let i = 0; i < count; i++) {
    write(i, matrix);
    for (let k = 0; k < 16; k++) data[i * 16 + k] = matrix.elements[k];
  }
  return data;
}

const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();

/** Build time only: decomposes a track placement into React friendly props. */
function placementAt(index: number, lateral: number, yOffset: number) {
  const matrix = new Matrix4();
  sampleMatrix(index, lateral, yOffset, 1, 1, 1, matrix);
  matrix.decompose(scratchPosition, scratchQuaternion, scratchScale);
  return {
    position: [scratchPosition.x, scratchPosition.y, scratchPosition.z],
    quaternion: [scratchQuaternion.x, scratchQuaternion.y, scratchQuaternion.z, scratchQuaternion.w],
  };
}

const CACHE = new Map<string, any>();

/** Builds each selected route once; geometry and textures are reused on replay. */
function circuitData() {
  const mapId = raceSession.mapId;
  const cached = CACHE.get(mapId);
  if (cached) return cached;

  // ------------------------------------------------------------- geometries
  const roadGeometry = buildRoadSurface();
  const markingGeometry = buildRoadMarkings();
  const railGeometry = buildGuardRail();
  const barrierGeometry = new BoxGeometry(0.36, 0.94, 4.3);
  const poleGeometry = new BoxGeometry(0.2, LAMP_HEIGHT, 0.24);
  const armGeometry = new BoxGeometry(1.85, 0.15, 0.18);
  const headGeometry = new BoxGeometry(0.66, 0.16, 0.34);
  const poolGeometry = new PlaneGeometry(9, 9);
  poolGeometry.rotateX(-Math.PI / 2);
  const pillarGeometry = new BoxGeometry(0.42, 6.4, 0.42);
  const bannerGeometry = new BoxGeometry(TRACK_WIDTH + 3.6, 1.9, 0.12);
  const cityGeometry = new BoxGeometry(1, 1, 1);
  const startLineGeometry = new PlaneGeometry(TRACK_WIDTH, 2.6);
  startLineGeometry.rotateX(-Math.PI / 2);

  // -------------------------------------------------------------- barriers
  const barrierSlots = slotsFor(BARRIER_STRIDE);
  const barrierCount = barrierSlots * 2;
  const barrierMatrices = fillMatrices(barrierCount, (index, matrix) => {
    const side = index < barrierSlots ? 1 : -1;
    const slot = index % barrierSlots;
    const stagger = slot % 2 === 0 ? 1 : 0.86;
    sampleMatrix(slot * BARRIER_STRIDE, side * WALL_OFFSET, 0.47 * stagger, 1, stagger, 1, matrix);
  });

  // ------------------------------------------------------------ street lamps
  const lampSlots = slotsFor(LAMP_STRIDE);
  const lampCount = lampSlots * 2;
  const lampMatrices = fillMatrices(lampCount, (index, matrix) => {
    const side = index < lampSlots ? 1 : -1;
    sampleMatrix((index % lampSlots) * LAMP_STRIDE, side * (WALL_OFFSET + 1.55), LAMP_HEIGHT / 2, 1, 1, 1, matrix);
  });
  const armMatrices = fillMatrices(lampCount, (index, matrix) => {
    const side = index < lampSlots ? 1 : -1;
    sampleMatrix((index % lampSlots) * LAMP_STRIDE, side * (WALL_OFFSET + 0.68), LAMP_HEIGHT - 0.12, 1, 1, 1, matrix);
  });
  const headMatrices = fillMatrices(lampCount, (index, matrix) => {
    const side = index < lampSlots ? 1 : -1;
    sampleMatrix((index % lampSlots) * LAMP_STRIDE, side * (WALL_OFFSET - 0.2), LAMP_HEIGHT - 0.2, 1, 1, 1, matrix);
  });
  const poolMatrices = fillMatrices(lampCount, (index, matrix) => {
    const side = index < lampSlots ? 1 : -1;
    sampleMatrix((index % lampSlots) * LAMP_STRIDE, side * (WALL_OFFSET - 0.2), 0.03, 1, 1, 1, matrix);
  });
  const lampPositions = new Float32Array(lampCount * 3);
  {
    const matrix = new Matrix4();
    for (let i = 0; i < lampCount; i++) {
      matrix.fromArray(headMatrices, i * 16);
      lampPositions[i * 3] = matrix.elements[12];
      lampPositions[i * 3 + 1] = matrix.elements[13];
      lampPositions[i * 3 + 2] = matrix.elements[14];
    }
  }

  // ------------------------------------------------------- checkpoint gates
  const pillarMatrices = fillMatrices(CHECKPOINT_COUNT * 2, (index, matrix) => {
    sampleMatrix(checkpointSample(index >> 1), (index % 2 === 0 ? 1 : -1) * (WALL_OFFSET + 0.62), 3.2, 1, 1, 1, matrix);
  });
  const banners = [];
  for (let gate = 0; gate < CHECKPOINT_COUNT; gate++) banners.push(placementAt(checkpointSample(gate), 0, 6.05));

  // ----------------------------------------------------------------- skyline
  const random = mulberry32(20260226);
  const cityCount = 54;
  const cityMatrices = fillMatrices(cityCount, (index, matrix) => {
    const angle = (index / cityCount) * Math.PI * 2 + random() * 0.08;
    const radius = 265 + random() * 130;
    const height = 24 + random() * 96;
    matrix.makeScale(16 + random() * 26, height, 16 + random() * 26);
    matrix.setPosition(Math.sin(angle) * radius, height / 2 - 3.2, Math.cos(angle) * radius);
  });

  // --------------------------------------------------------------- textures
  const asphalt = makeAsphaltTextures();
  const ground = makeGroundTexture();
  ground.repeat.set(90, 90);
  const glow = makeGlowTexture();
  const sky = makeSkyTexture();
  const skyDay = makeDaySkyTexture();
  const skyRain = makeStormSkyTexture();
  const rainStreak = makeRainStreakTexture();
  const chequer = makeChequerTexture();
  const startSign = makeSignTexture("START / FINISH", "LAP TIMING LINE", "#F5C518");
  const splitSign = makeSignTexture("CHECKPOINT", "SECTOR SPLIT", "#DC1A22");

  // --------------------------------------------------------------- rain box
  const rainPositions = new Float32Array(RAIN_COUNT * 3);
  const rainSpeeds = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPositions[i * 3] = (random() - 0.5) * RAIN_AREA;
    rainPositions[i * 3 + 1] = random() * RAIN_HEIGHT;
    rainPositions[i * 3 + 2] = (random() - 0.5) * RAIN_AREA;
    rainSpeeds[i] = 21 + random() * 15;
  }
  const rainGeometry = new BufferGeometry();
  const rainPositionAttribute = new BufferAttribute(rainPositions, 3).setUsage(DynamicDrawUsage);
  rainGeometry.setAttribute("position", rainPositionAttribute);

  const data = {
    roadGeometry,
    markingGeometry,
    railGeometry,
    startLineGeometry,
    barrierGeometry,
    barrierMatrices,
    barrierCount,
    poleGeometry,
    armGeometry,
    headGeometry,
    poolGeometry,
    lampMatrices,
    armMatrices,
    headMatrices,
    poolMatrices,
    lampCount,
    lampPositions,
    pillarGeometry,
    pillarMatrices,
    bannerGeometry,
    banners,
    cityGeometry,
    cityMatrices,
    cityCount,
    asphalt,
    ground,
    glow,
    sky,
    skyDay,
    skyRain,
    rainStreak,
    rainPositions,
    rainSpeeds,
    rainGeometry,
    chequer,
    startSign,
    splitSign,
    lampColor: new Color("#ffe6b8").multiplyScalar(2.2),
    headColor: new Color("#fff4da").multiplyScalar(3.2),
  };
  CACHE.set(mapId, data);
  return data;
}

/** Build a route's heavy static scene cache before the player confirms Start Race. */
export function warmRaceCircuit(mapId: string) {
  if (CACHE.has(mapId)) return true;
  const previousMapId = raceSession.mapId;
  if (!selectRaceTrack(mapId)) return false;
  try {
    circuitData();
    return CACHE.has(mapId);
  } finally {
    if (previousMapId !== mapId) selectRaceTrack(previousMapId);
  }
}

function useInstanceMatrices(ref: any, data: Float32Array) {
  useLayoutEffect(() => {
    const mesh = ref.current as InstancedMesh | null;
    if (!mesh) return;
    const matrix = new Matrix4();
    const count = data.length / 16;
    for (let i = 0; i < count; i++) {
      matrix.fromArray(data, i * 16);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, data]);
}

/**
 * Four pooled point lights snapped to the closest lamp heads. The shader always
 * sees four lights no matter how many lamps line the circuit.
 */
const LampPool = memo(function LampPool({ positions }: { positions: Float32Array }) {
  const lights = useRef<PointLight[]>([]);
  const tick = useRef(0);
  const lit = useRef(false);
  const best = useMemo(() => new Float32Array(LIGHT_POOL), []);
  const chosen = useMemo(() => new Int32Array(LIGHT_POOL), []);
  useFrame(() => {
    const intensity = currentEnv().lampIntensity;
    if (intensity <= 0) {
      // Daylight parks all four lamps at zero and skips the sort altogether.
      if (lit.current) {
        lit.current = false;
        for (let k = 0; k < LIGHT_POOL; k++) {
          const light = lights.current[k];
          if (light) light.intensity = 0;
        }
      }
      return;
    }
    lit.current = true;
    // The nearest-lamp sort only needs to run a few times per second.
    if (tick.current++ % 5 !== 0) return;
    const total = positions.length / 3;
    for (let k = 0; k < LIGHT_POOL; k++) {
      best[k] = Infinity;
      chosen[k] = -1;
    }
    for (let i = 0; i < total; i++) {
      const dx = positions[i * 3] - raceDrive.x;
      const dz = positions[i * 3 + 2] - raceDrive.z;
      const distance = dx * dx + dz * dz;
      for (let k = 0; k < LIGHT_POOL; k++) {
        if (distance >= best[k]) continue;
        for (let shift = LIGHT_POOL - 1; shift > k; shift--) {
          best[shift] = best[shift - 1];
          chosen[shift] = chosen[shift - 1];
        }
        best[k] = distance;
        chosen[k] = i;
        break;
      }
    }
    for (let k = 0; k < LIGHT_POOL; k++) {
      const light = lights.current[k];
      if (!light) continue;
      const index = chosen[k];
      if (index < 0) {
        light.intensity = 0;
        continue;
      }
      light.position.set(positions[index * 3], positions[index * 3 + 1] - 0.3, positions[index * 3 + 2]);
      light.intensity = intensity;
    }
  }, -10);

  return (
    <>
      {Array.from({ length: LIGHT_POOL }, (_, k) => k).map((k) => (
        <pointLight
          key={k}
          ref={(node: PointLight) => {
            if (node) lights.current[k] = node;
          }}
          color="#ffd9a0"
          intensity={0}
          distance={28}
          decay={1.7}
        />
      ))}
    </>
  );
});

/**
 * Rain: one point cloud that rides with the car. Streaks fall in the volume's
 * local space and wrap around when they hit the floor, so no particle is ever
 * created or destroyed during a race. Hidden entirely when the preset is dry.
 */
const RainFall = memo(function RainFall({ data }: { data: any }) {
  const group = useRef<any>(null);
  const attribute = data.rainGeometry.getAttribute("position");
  const positions = data.rainPositions;
  const speeds = data.rainSpeeds;

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const env = currentEnv();
    const visible = env.rain > 0 && raceDrive.active;
    node.visible = visible;
    if (!visible) return;
    node.position.set(raceDrive.x, raceDrive.y, raceDrive.z);
    const step = Math.min(delta, 0.05);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const y = positions[i * 3 + 1] - speeds[i] * step;
      positions[i * 3 + 1] = y < 0 ? y + RAIN_HEIGHT : y;
    }
    attribute.needsUpdate = true;
  }, -8);

  return (
    <group ref={group} visible={false}>
      <points geometry={data.rainGeometry} frustumCulled={false} raycast={() => null}>
        <pointsMaterial
          map={data.rainStreak}
          color="#c3d8f2"
          size={0.36}
          sizeAttenuation
          transparent
          opacity={0.46}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
});

export const RaceCircuit = memo(function RaceCircuit() {
  const data = useMemo(() => circuitData(), []);
  const invalidate = useThree((state) => state.invalidate);
  const barriers = useRef<InstancedMesh>(null);
  const lamps = useRef<InstancedMesh>(null);
  const arms = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const pools = useRef<InstancedMesh>(null);
  const pillars = useRef<InstancedMesh>(null);
  const city = useRef<InstancedMesh>(null);
  const skyMaterial = useRef<any>(null);
  const fog = useRef<any>(null);
  const markingMaterial = useRef<any>(null);
  const poolMaterial = useRef<any>(null);
  const headMaterial = useRef<any>(null);
  const cityMaterial = useRef<any>(null);
  /** Preset index the materials were last tuned for — latches the writes. */
  const appliedEnv = useRef(-1);

  useInstanceMatrices(barriers, data.barrierMatrices);
  useInstanceMatrices(lamps, data.lampMatrices);
  useInstanceMatrices(arms, data.armMatrices);
  useInstanceMatrices(heads, data.headMatrices);
  useInstanceMatrices(pools, data.poolMatrices);
  useInstanceMatrices(pillars, data.pillarMatrices);
  useInstanceMatrices(city, data.cityMatrices);
  useLayoutEffect(() => markShadowsDirty(), []);

  // A HUD button may flip the weather while the demand loop is idle, so the
  // subscription flags the change and asks for exactly one frame.
  useEffect(
    () =>
      subscribeRaceSession(() => {
        appliedEnv.current = -1;
        invalidate();
      }),
    [invalidate],
  );

  useFrame(() => {
    if (appliedEnv.current === raceSession.envIndex) return;
    appliedEnv.current = raceSession.envIndex;
    const env = currentEnv();

    // Both skies are already compiled into the material, so swapping the map is
    // a texture bind — not a shader recompile.
    if (skyMaterial.current) {
      skyMaterial.current.map =
        env.sky === "day" ? data.skyDay : env.sky === "rain" ? data.skyRain : data.sky;
    }
    const fogNode = fog.current;
    if (fogNode) {
      fogNode.color.set(env.fogColor);
      fogNode.near = env.fogNear;
      fogNode.far = env.fogFar;
    }
    if (markingMaterial.current) {
      markingMaterial.current.emissive.set(env.markingEmissive);
      markingMaterial.current.emissiveIntensity = env.markingEmissiveIntensity;
    }
    if (cityMaterial.current) {
      cityMaterial.current.color.set(env.cityColor);
      cityMaterial.current.emissive.set(env.cityEmissive);
      cityMaterial.current.emissiveIntensity = env.cityEmissiveIntensity;
    }
    if (poolMaterial.current) poolMaterial.current.opacity = env.poolOpacity;
    if (headMaterial.current) {
      // Daylight kills the lamp glow; the heads read as plain glass domes.
      headMaterial.current.color.copy(data.headColor).multiplyScalar(env.lampIntensity > 0 ? 1 : 0.06);
    }
    markShadowsDirty();
    invalidate();
  }, -9);

  return (
    <>
      {/* Weather fog, retuned from the active preset — never remounted. */}
      <fog ref={fog} attach="fog" args={["#080d18", 40, 520]} />
      <RainFall data={data} />

      {/* Sky dome: the only mesh that must never be frustum culled. */}
      <mesh raycast={() => null} frustumCulled={false}>
        <sphereGeometry args={[620, 32, 16]} />
        <meshBasicMaterial
          ref={skyMaterial}
          map={data.sky}
          side={BackSide}
          toneMapped={false}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh receiveShadow raycast={() => null} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.2, 0]}>
        <planeGeometry args={[2200, 2200]} />
        <meshStandardMaterial map={data.ground} roughness={0.96} metalness={0.04} />
      </mesh>

      {/* Asphalt, painted edges and guard rails: three merged ribbons. */}
      <mesh geometry={data.roadGeometry} receiveShadow raycast={() => null}>
        <meshStandardMaterial
          map={data.asphalt.map}
          roughnessMap={data.asphalt.roughnessMap}
          roughness={0.94}
          metalness={0.05}
        />
      </mesh>
      <mesh geometry={data.markingGeometry} raycast={() => null}>
        <meshStandardMaterial
          ref={markingMaterial}
          color="#e7ebf1"
          roughness={0.55}
          metalness={0.02}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={data.railGeometry} castShadow raycast={() => null}>
        <meshStandardMaterial color="#98a2ad" metalness={0.86} roughness={0.32} side={DoubleSide} />
      </mesh>

      {/* Start / finish chequered strip laid across the tarmac. */}
      <mesh geometry={data.startLineGeometry} raycast={() => null} {...placementAt(0, 0, 0.02)}>
        <meshStandardMaterial
          map={data.chequer}
          roughness={0.62}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-3}
        />
      </mesh>

      {/* Modular turn barriers — one draw call for both sides of the loop. */}
      <instancedMesh
        ref={barriers}
        args={[undefined, undefined, data.barrierCount]}
        geometry={data.barrierGeometry}
        castShadow
        receiveShadow
        raycast={() => null}
      >
        <meshStandardMaterial color="#c8cdd6" roughness={0.74} metalness={0.06} />
      </instancedMesh>

      {/* Street furniture: pole, arm, head and the additive light pool. */}
      <instancedMesh ref={lamps} args={[undefined, undefined, data.lampCount]} geometry={data.poleGeometry} castShadow raycast={() => null}>
        <meshStandardMaterial color="#2c313a" metalness={0.72} roughness={0.36} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, data.lampCount]} geometry={data.armGeometry} raycast={() => null}>
        <meshStandardMaterial color="#2c313a" metalness={0.72} roughness={0.36} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, data.lampCount]} geometry={data.headGeometry} raycast={() => null}>
        <meshBasicMaterial ref={headMaterial} color={data.headColor} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[undefined, undefined, data.lampCount]} geometry={data.poolGeometry} raycast={() => null}>
        <meshBasicMaterial
          ref={poolMaterial}
          map={data.glow}
          color={data.lampColor}
          transparent
          opacity={0.34}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <LampPool positions={data.lampPositions} />

      {/* Checkpoint gantries: shared pillars + two shared banner materials. */}
      <instancedMesh
        ref={pillars}
        args={[undefined, undefined, CHECKPOINT_COUNT * 2]}
        geometry={data.pillarGeometry}
        castShadow
        raycast={() => null}
      >
        <meshStandardMaterial color="#20242c" metalness={0.68} roughness={0.4} />
      </instancedMesh>
      {data.banners.map((placement: any, index: number) => (
        <mesh
          key={index}
          geometry={data.bannerGeometry}
          raycast={() => null}
          position={placement.position}
          quaternion={placement.quaternion}
        >
          <meshBasicMaterial map={index === 0 ? data.startSign : data.splitSign} color="#cfd6e2" toneMapped={false} />
        </mesh>
      ))}

      {/* A low skyline ring closes the horizon without extra draw calls. */}
      <instancedMesh
        ref={city}
        args={[undefined, undefined, data.cityCount]}
        geometry={data.cityGeometry}
        raycast={() => null}
      >
        <meshStandardMaterial ref={cityMaterial} color="#0d1220" emissive="#12203c" emissiveIntensity={0.55} roughness={0.92} metalness={0.22} />
      </instancedMesh>
    </>
  );
});
