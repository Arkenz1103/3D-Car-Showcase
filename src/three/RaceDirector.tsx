// @ts-nocheck
/**
 * Race driver: keyboard input, the fixed-step simulation tick, the chase camera
 * and the handful of dynamic race visuals (moving sun, nitro plumes).
 *
 * Everything here runs inside `useFrame`. No `Vector3` / `Quaternion` is ever
 * constructed in that loop — the scratch objects below are module level and are
 * reused frame after frame.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, PlaneGeometry, Vector3 } from "three";
import { makePlumeTexture } from "./raceAssets";
import {
  abortRace,
  applyNitroImpulse,
  pauseRace,
  raceDrive,
  raceInput,
  racePhase,
  recoverVehicle,
  startRaceSequence,
  stepRace,
} from "./raceEngine";
import { markShadowsDirty } from "./sceneMotion";
import { currentEnv, cycleCamera, cycleEnvironment, raceSession } from "./raceSession";
import { triggerNitroBurst, updateAudio } from "./raceAudio";

/** Camera framing constants — one place to tune the whole race feel. */
const CAM = { base: 8.5, height: 2.7, look: 10.5, fov: 62, follow: 8.4 };

/**
 * Per camera mount: eye offset along forward / up / left, the look-ahead
 * distance and the base field of view. Index matches `raceSession.camMode`, so
 * switching mounts is a table read instead of a branch tree.
 *  0 chase — behind and above, the classic third person rig
 *  1 hood  — low over the nose, wheels and tarmac filling the frame
 *  2 cockpit — driver's eyeline, looking over the steering wheel
 */
const CAM_MOUNTS = [
  { fwd: 0, up: 0, left: 0, look: 10.5, fov: 62, roll: 0.55, near: 0.3 },
  { fwd: 0.42, up: 0.94, left: 0, look: 22, fov: 70, roll: 0.7, near: 0.18 },
  { fwd: -0.26, up: 1.07, left: 0.33, look: 24, fov: 72, roll: 0.85, near: 0.06 },
];

const camGoal = new Vector3();
const camForward = new Vector3();
const camLook = new Vector3();
const sunOffset = new Vector3(62, 78, 34);
const sunGoal = new Vector3();

/** Which preset the lights were last tuned for — avoids re-writing them per frame. */
let appliedEnvIndex = -1;

/** Held key state — booleans only, so the handlers never allocate. */
const held = { forward: false, back: false, left: false, right: false, boost: false, handbrake: false };
let boostLatch = false;

function releaseKeys() {
  held.forward = held.back = held.left = held.right = held.boost = held.handbrake = false;
  boostLatch = false;
  raceInput.throttle = 0;
  raceInput.brake = 0;
  raceInput.steer = 0;
  raceInput.boost = false;
  raceInput.handbrake = false;
}

/**
 * Applies the live simulation transform to the vehicle. Kept separate from
 * <RaceDirector/> so the car element can stay mounted (and its GLB / shader
 * warm-up cache stay warm) while the showroom and race modes swap around it.
 */
export const RaceVehicleRig = memo(function RaceVehicleRig({ children }: { children: React.ReactNode }) {
  const group = useRef<any>(null);
  useLayoutEffect(() => {
    if (group.current) group.current.rotation.order = "YXZ";
  }, []);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    if (raceDrive.active) {
      node.position.set(raceDrive.x, raceDrive.y, raceDrive.z);
      node.rotation.set(raceDrive.pitch, raceDrive.heading, raceDrive.roll, "YXZ");
      markShadowsDirty();
      return;
    }
    // Leaving the circuit hands the car back to the showroom turntable: the rig
    // must release its transform or the car would stay parked on the track.
    if (node.position.x !== 0 || node.position.y !== 0 || node.position.z !== 0) {
      node.position.set(0, 0, 0);
      node.rotation.set(0, 0, 0, "YXZ");
    }
  }, -3);
  return (
    <group ref={group} name="Race_Vehicle_Rig">
      {children}
    </group>
  );
});

/**
 * The key light follows the car: a 116 m shadow frustum tracks the action, so
 * shadow texel density stays high no matter where the car is on the circuit.
 *
 * Every colour and intensity below is driven by the active weather preset, and
 * the light COUNT never changes — hemisphere + ambient + key + rim is the whole
 * thermal budget, so switching from Day to Rain only rewrites uniforms (no
 * shader recompile, no extra shadow map).
 */
export const RaceSunlight = memo(function RaceSunlight() {
  const light = useRef<any>(null);
  const target = useRef<any>(null);
  const hemi = useRef<any>(null);
  const ambient = useRef<any>(null);
  const rim = useRef<any>(null);

  const applyPreset = () => {
    const env = currentEnv();
    if (hemi.current) {
      hemi.current.color.set(env.hemiSky);
      hemi.current.groundColor.set(env.hemiGround);
      hemi.current.intensity = env.hemiIntensity;
    }
    if (ambient.current) {
      ambient.current.color.set(env.ambientColor);
      ambient.current.intensity = env.ambientIntensity;
    }
    if (light.current) {
      light.current.color.set(env.keyColor);
      light.current.intensity = env.keyIntensity;
    }
    if (rim.current) {
      rim.current.color.set(env.rimColor);
      rim.current.intensity = env.rimIntensity;
    }
    appliedEnvIndex = raceSession.envIndex;
    markShadowsDirty();
  };

  useFrame(() => {
    const node = light.current;
    if (!node) return;
    if (appliedEnvIndex !== raceSession.envIndex) applyPreset();
    sunGoal.set(raceDrive.x + sunOffset.x, raceDrive.y + sunOffset.y, raceDrive.z + sunOffset.z);
    node.position.copy(sunGoal);
    if (target.current) {
      target.current.position.set(raceDrive.x, raceDrive.y, raceDrive.z);
      target.current.updateMatrixWorld();
    }
  }, -12);

  useLayoutEffect(() => {
    applyPreset();
  }, []);

  return (
    <>
      <hemisphereLight ref={hemi} args={["#41597f", "#080a10", 0.5]} />
      <ambientLight ref={ambient} intensity={0.24} color="#2c3852" />
      <directionalLight
        ref={light}
        castShadow
        color="#cfe0ff"
        intensity={2.1}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-58}
        shadow-camera-right={58}
        shadow-camera-top={58}
        shadow-camera-bottom={-58}
        shadow-camera-near={1}
        shadow-camera-far={260}
        shadow-bias={-0.0006}
        shadow-normalBias={0.035}
      />
      <object3D ref={target} />
      {/* A cool rim from the opposite side keeps the car silhouette readable. */}
      <directionalLight ref={rim} position={[-64, 30, -80]} color="#5b7fd8" intensity={0.55} />
    </>
  );
});

/** Twin nitro plumes that flare with the boost envelope. */
export const NitroPlumes = memo(function NitroPlumes() {
  const plumes = useRef<any[]>([]);
  const data = useMemo(() => {
    const texture = makePlumeTexture();
    const geometry = new PlaneGeometry(0.6, 1.85);
    return { texture, geometry };
  }, []);
  useFrame(() => {
    const fx = raceDrive.boostFx;
    const visible = raceDrive.active && fx > 0.02;
    for (let i = 0; i < 2; i++) {
      const node = plumes.current[i];
      if (!node) continue;
      node.visible = visible;
      if (!visible) continue;
      node.scale.set(0.8 + fx * 0.45, 0.72 + fx * 1.45, 1);
    }
  }, -2);
  return (
    <group>
      {[-0.36, 0.36].map((x, index) => (
        <mesh
          key={x}
          ref={(node: any) => {
            if (node) plumes.current[index] = node;
          }}
          position={[x, 0.5, 2.28]}
          rotation={[-0.12, 0, Math.PI]}
          geometry={data.geometry}
          raycast={() => null}
          visible={false}
        >
          <meshBasicMaterial
            map={data.texture}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
});

/**
 * The race mode driver. Mounting it starts the standing start; unmounting it
 * pulls the car back off the circuit and restores the showroom camera planes.
 */
export const RaceDirector = memo(function RaceDirector() {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const clock = useRef(0);
  const settled = useRef(false);
  /** Last camera mount applied — latches the near-plane write to the switch. */
  const camView = useRef(-1);

  // Enter: fresh grid slot, wide projection planes, pressed-key bookkeeping.
  useLayoutEffect(() => {
    camera.near = 0.3;
    camera.far = 1500;
    camera.updateProjectionMatrix();
    settled.current = false;
    camView.current = -1;
    clock.current = 0;
    releaseKeys();
    startRaceSequence();
    invalidate();
    return () => {
      // Unmounting IS leaving the circuit: park the simulation so the rig
      // releases the car and the HUD's next mount starts from a clean grid slot.
      releaseKeys();
      abortRace();
      camera.near = 0.08;
      camera.far = 60;
      camera.fov = 40;
      camera.updateProjectionMatrix();
    };
  }, [camera, invalidate]);

  useLayoutEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          held.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          held.back = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          held.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          held.right = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          held.boost = true;
          if (!boostLatch) {
            boostLatch = true;
            // Only fire the whoosh when the bottle actually had something in it.
            if (applyNitroImpulse()) triggerNitroBurst();
          }
          break;
        case "Space":
          held.handbrake = true;
          break;
        case "KeyC":
          // Cycles chase -> hood -> cockpit without touching React.
          cycleCamera();
          break;
        case "KeyE":
          // Day -> Night -> Rain; the circuit reads the preset in its own frame.
          cycleEnvironment();
          break;
        case "KeyR":
          recoverVehicle();
          break;
        case "Escape":
        case "KeyP":
          pauseRace(racePhase() === "racing");
          break;
        default:
          return;
      }
      if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
      invalidate();
    };
    const keyup = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
        case "ArrowUp":
          held.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          held.back = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          held.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          held.right = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          held.boost = false;
          boostLatch = false;
          break;
        case "Space":
          held.handbrake = false;
          break;
        default:
          return;
      }
      invalidate();
    };
    const blur = () => releaseKeys();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [invalidate]);

  useFrame((state, delta) => {
    clock.current += delta;

    // Analogue ramps: a tap is a tap, a hold is a hold.
    raceInput.throttle = held.forward ? 1 : 0;
    raceInput.brake = held.back ? 1 : 0;
    raceInput.steer = (held.left ? 1 : 0) - (held.right ? 1 : 0);
    raceInput.boost = held.boost;
    raceInput.handbrake = held.handbrake;

    stepRace(delta);

    // -------------------------------------------------------------- audio
    // Same telemetry the HUD polls, so the engine note and the tach always
    // agree. Ramped to silence while paused; nothing is scheduled per frame.
    updateAudio(delta, raceDrive.active && racePhase() !== "paused");

    // ------------------------------------------------------------- camera
    const phase = racePhase();
    // A pause freezes the demand-driven loop completely: no ticks, no GPU work.
    // Any key press re-invalidates and picks the race back up.
    if (phase === "paused") return;

    const speed = raceDrive.speed;
    camForward.set(-Math.sin(raceDrive.heading), 0, -Math.cos(raceDrive.heading));

    const mount = CAM_MOUNTS[raceSession.camMode];
    // The cockpit sits centimetres from the glass, so the near plane shrinks
    // with it. Applied once per mount change — never per frame.
    if (camView.current !== raceSession.camMode) {
      camView.current = raceSession.camMode;
      if (Math.abs(camera.near - mount.near) > 1e-4) {
        camera.near = mount.near;
        camera.updateProjectionMatrix();
      }
      settled.current = false;
    }

    const orbit = raceSession.camMode === 0 && (phase === "countdown" || phase === "finished");

    if (orbit) {
      // Slow hero orbit while the grid lights run, and again on the podium.
      const angle = clock.current * (phase === "countdown" ? 0.42 : 0.26);
      const radius = phase === "countdown" ? 10.5 : 15;
      camGoal.set(
        raceDrive.x + Math.sin(angle) * radius,
        raceDrive.y + 3.1 + Math.sin(clock.current * 0.5) * 0.35,
        raceDrive.z + Math.cos(angle) * radius,
      );
    } else if (raceSession.camMode === 0) {
      const back = CAM.base + speed * 0.055 + raceDrive.boostFx * 1.7;
      const lift = CAM.height + speed * 0.014;
      camGoal.set(
        raceDrive.x - camForward.x * back,
        raceDrive.y + lift,
        raceDrive.z - camForward.z * back,
      );
    } else {
      // Hood / cockpit mounts ride with the body: the eye offset is expressed
      // in the car's own frame, so no extra matrix math is needed.
      const leftX = -Math.cos(raceDrive.heading);
      const leftZ = Math.sin(raceDrive.heading);
      camGoal.set(
        raceDrive.x + camForward.x * mount.fwd + leftX * mount.left,
        raceDrive.y + mount.up,
        raceDrive.z + camForward.z * mount.fwd + leftZ * mount.left,
      );
    }

    if (raceDrive.crashFx > 0.001) {
      const shake = raceDrive.crashFx * 0.4;
      camGoal.x += Math.sin(clock.current * 41) * shake;
      camGoal.y += Math.cos(clock.current * 37) * shake * 0.6;
    }

    if (!settled.current) {
      camera.position.copy(camGoal);
      settled.current = true;
    } else {
      // Mounted views are bolted on, so they stiffen to keep the horizon still.
      const follow = raceSession.camMode === 0 ? CAM.follow : 26;
      const blend = 1 - Math.exp(-follow * Math.min(delta, 0.05) * (phase === "racing" ? 1 : 1.6));
      camera.position.lerp(camGoal, blend);
    }

    camLook.set(
      raceDrive.x + camForward.x * mount.look,
      raceDrive.y + (raceSession.camMode === 0 ? 1.05 : mount.up - 0.06),
      raceDrive.z + camForward.z * mount.look,
    );
    camera.lookAt(camLook);
    camera.rotation.z += raceDrive.roll * mount.roll;

    // Nitro punch: the pulse is driven by the engine's boost envelope.
    const fov = mount.fov + raceDrive.boostFx * 15 + Math.min(speed, 84) * 0.11;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    markShadowsDirty();
    state.invalidate();
  }, -6);

  return null;
});
