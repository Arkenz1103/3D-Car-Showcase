// @ts-nocheck
/**
 * Race driver: keyboard input, the fixed-step simulation tick, the chase camera
 * and the handful of dynamic race visuals (moving sun, turbo plumes and impact sparks).
 *
 * Everything here runs inside `useFrame`. No `Vector3` / `Quaternion` is ever
 * constructed in that loop — the scratch objects below are module level and are
 * reused frame after frame.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, PlaneGeometry, Vector3 } from "three";
import { makePlumeTexture } from "./raceAssets";
import {
  abortRace,
  activateTurbo,
  pauseRace,
  prepareRaceGrid,
  raceAi,
  raceDrive,
  raceInput,
  racePhase,
  startRaceSequence,
  stepRace,
  subscribeRace,
} from "./raceEngine";
import { markShadowsDirty } from "./sceneMotion";
import { currentEnv, cycleCamera, raceSession, setCameraMode } from "./raceSession";
import { playRaceCountdownTone, playRaceGoChime, triggerTurboBurst, updateAudio } from "./raceAudio";

/** Camera framing constants — one place to tune the whole race feel. */
const CAM = { base: 8.5, height: 2.7, look: 10.5, fov: 62, follow: 8.4 };
const RACE_FRAME_INTERVAL = 1000 / 60;

/**
 * Per camera mount: eye offset along forward / up / left, the look-ahead
 * distance and the base field of view. Index matches `raceSession.camMode`, so
 * switching mounts is a table read instead of a branch tree.
 *  0 chase — behind and above, the classic third person rig
 *  1 hood  — low over the nose, wheels and tarmac filling the frame
 *  2 cockpit — driver's eyeline, looking over the steering wheel
 */
const CAM_MOUNTS = [
  { fwd: 0, up: 0, left: 0, look: 10.5, fov: 62, near: 0.3 },
  { fwd: 0.42, up: 0.94, left: 0, look: 22, fov: 70, near: 0.18 },
  { fwd: -0.26, up: 1.07, left: 0.33, look: 24, fov: 72, near: 0.06 },
];

const camGoal = new Vector3();
const camForward = new Vector3();
const camLook = new Vector3();
const sunOffset = new Vector3(62, 78, 34);
const sunGoal = new Vector3();

/** Which preset the lights were last tuned for — avoids re-writing them per frame. */
let appliedEnvIndex = -1;

/** Held key state — booleans only, so the handlers never allocate. */
const held = { forward: false, back: false, left: false, right: false, drift: false, handbrake: false };

function releaseKeys() {
  held.forward = held.back = held.left = held.right = held.drift = held.handbrake = false;
  raceInput.throttle = 0;
  raceInput.brake = 0;
  raceInput.steer = 0;
  raceInput.handbrake = false;
}

function requestNextRaceFrame(state: any, gate: { last: number; timer: number }) {
  const now = performance.now();
  const elapsed = now - gate.last;
  if (elapsed >= RACE_FRAME_INTERVAL) {
    gate.last = now;
    state.invalidate();
  } else if (!gate.timer) {
    gate.timer = window.setTimeout(() => {
      gate.timer = 0;
      gate.last = performance.now();
      state.invalidate();
    }, RACE_FRAME_INTERVAL - elapsed);
  }
}

/**
 * Applies the live simulation transform to the vehicle. Kept separate from
 * <RaceDirector/> so the car element can stay mounted (and its GLB / shader
 * warm-up cache stay warm) while the showroom and race modes swap around it.
 */
export const RaceSceneReady = memo(function RaceSceneReady({ onReady }: { onReady: () => void }) {
  const invalidate = useThree((state) => state.invalidate);
  const renderedFrames = useRef(0);
  const timer = useRef<number | null>(null);
  const wakeTimer = useRef<number | null>(null);

  // Demand rendering can otherwise go idle between mounting the track and its
  // first draw. Nudge it until two scene frames have reached the renderer.
  useEffect(() => {
    invalidate();
    wakeTimer.current = window.setInterval(invalidate, 80);
    return () => {
      if (wakeTimer.current !== null) window.clearInterval(wakeTimer.current);
      wakeTimer.current = null;
    };
  }, [invalidate]);

  useFrame(() => {
    if (timer.current !== null) return;
    renderedFrames.current += 1;
    if (renderedFrames.current < 2) return;
    if (wakeTimer.current !== null) {
      window.clearInterval(wakeTimer.current);
      wakeTimer.current = null;
    }
    // Two rendered frames upload the scene resources; a short grace period
    // lets the browser settle before the loading overlay is dismissed.
    timer.current = window.setTimeout(onReady, 450);
  }, 0);

  useLayoutEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (wakeTimer.current !== null) window.clearInterval(wakeTimer.current);
  }, []);
  return null;
});

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

/** Short, allocation-free spark streaks at the car on a barrier impact. */
export const RaceCrashSparks = memo(function RaceCrashSparks() {
  const sparks = useRef<any>(null);
  const age = useRef(1);
  const previousFx = useRef(0);
  const buffers = useMemo(() => {
    const count = 18;
    const origins = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963;
      const offset = i * 3;
      origins[offset] = Math.sin(angle) * 0.7;
      origins[offset + 1] = 0.12 + (i % 4) * 0.16;
      origins[offset + 2] = Math.cos(angle) * 0.44;
      velocities[offset] = Math.sin(angle) * (2.2 + (i % 4) * 0.55);
      velocities[offset + 1] = 0.7 + (i % 5) * 0.24;
      velocities[offset + 2] = Math.cos(angle) * (1.6 + (i % 3) * 0.5);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return { count, origins, velocities, geometry };
  }, []);

  useFrame((_, delta) => {
    const node = sparks.current;
    if (!node) return;
    const fx = raceDrive.crashFx;
    if (fx > previousFx.current + 0.08) age.current = 0;
    else age.current = Math.min(1, age.current + delta);
    previousFx.current = fx;

    const active = raceDrive.active && fx > 0.05 && age.current < 0.34;
    node.visible = active;
    if (!active) return;
    node.position.set(raceDrive.x, raceDrive.y + 0.48, raceDrive.z);
    node.rotation.y = raceDrive.heading;
    const t0 = age.current;
    const t1 = t0 + 0.055;
    const position = buffers.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < buffers.count; i++) {
      const offset = i * 3;
      const out = i * 6;
      const ox = buffers.origins[offset];
      const oy = buffers.origins[offset + 1];
      const oz = buffers.origins[offset + 2];
      const vx = buffers.velocities[offset];
      const vy = buffers.velocities[offset + 1];
      const vz = buffers.velocities[offset + 2];
      position[out] = ox + vx * t0;
      position[out + 1] = oy + vy * t0 - 2.2 * t0 * t0;
      position[out + 2] = oz + vz * t0;
      position[out + 3] = ox + vx * t1;
      position[out + 4] = oy + vy * t1 - 2.2 * t1 * t1;
      position[out + 5] = oz + vz * t1;
    }
    buffers.geometry.attributes.position.needsUpdate = true;
    node.material.opacity = Math.max(0, 1 - t0 / 0.34) * Math.min(1, fx * 1.7);
  }, -1);

  return (
    <lineSegments ref={sparks} geometry={buffers.geometry} visible={false} frustumCulled={false} raycast={() => null}>
      <lineBasicMaterial color="#ffd477" transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
});

/**
 * The race mode driver. Mounting it starts the standing start; unmounting it
 * pulls the car back off the circuit and restores the showroom camera planes.
 */
export const RaceDirector = memo(function RaceDirector({
  onCinematicComplete,
}: {
  onCinematicComplete: () => void;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const clock = useRef(0);
  const cinematic = useRef(true);
  const countdownPending = useRef(false);
  const cinematicStartedAt = useRef(0);
  const settled = useRef(false);
  const frameGate = useRef({ last: 0, timer: 0 });
  /** Last camera mount applied — latches the near-plane write to the switch. */
  const camView = useRef(-1);

  // Stage the car silently. The HUD and five-second lights stay hidden until
  // the cinematic has completed and the camera reaches the chase position.
  useLayoutEffect(() => {
    camera.near = 0.3;
    camera.far = 1500;
    camera.updateProjectionMatrix();
    settled.current = false;
    camView.current = 0;
    setCameraMode(0);
    clock.current = 0;
    frameGate.current.last = 0;
    if (frameGate.current.timer) window.clearTimeout(frameGate.current.timer);
    frameGate.current.timer = 0;
    countdownPending.current = false;
    releaseKeys();
    const stopCountdownAudio = subscribeRace((event) => {
      if (event.type === "countdown" && event.value > 0) playRaceCountdownTone(event.value);
      else if (event.type === "go") playRaceGoChime();
    });
    prepareRaceGrid();
    cinematic.current = true;
    cinematicStartedAt.current = performance.now();
    camForward.set(-Math.sin(raceDrive.heading), 0, -Math.cos(raceDrive.heading));
    const rightX = Math.cos(raceDrive.heading);
    const rightZ = -Math.sin(raceDrive.heading);
    camera.up.set(0, 1, 0);
    // Start on a low right-front-quarter view, framed on the user's wheel and body.
    camera.position.set(
      raceDrive.x + camForward.x * 0.3 + rightX * 3.9,
      raceDrive.y + 0.42,
      raceDrive.z + camForward.z * 0.3 + rightZ * 3.9,
    );
    camLook.set(
      raceDrive.x + camForward.x * 1.4 + rightX * 0.62,
      raceDrive.y + 0.74,
      raceDrive.z + camForward.z * 1.4 + rightZ * 0.62,
    );
    camera.fov = CAM_MOUNTS[0].fov;
    camera.lookAt(camLook);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    settled.current = true;
    invalidate();
    return () => {
      cinematic.current = false;
      countdownPending.current = false;
      stopCountdownAudio();
      if (frameGate.current.timer) window.clearTimeout(frameGate.current.timer);
      frameGate.current.timer = 0;
      releaseKeys();
      abortRace();
      camera.near = 0.08;
      camera.far = 60;
      camera.fov = 40;
      camera.updateProjectionMatrix();
    };
  }, [camera, invalidate, onCinematicComplete]);

  useLayoutEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || cinematic.current || countdownPending.current) return;
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
          held.drift = true;
          break;
        case "Space":
          held.handbrake = true;
          break;
        case "KeyQ":
          // One press fires a finite turbo burst; it cannot be held or spammed.
          if (activateTurbo()) triggerTurboBurst();
          break;
        case "KeyC":
          // Cycles chase -> hood -> cockpit without touching React.
          cycleCamera();
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
          held.drift = false;
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
    if (cinematic.current) {
      const elapsed = Math.max(0, (performance.now() - cinematicStartedAt.current) / 1000);
      camForward.set(-Math.sin(raceDrive.heading), 0, -Math.cos(raceDrive.heading));
      const rightX = Math.cos(raceDrive.heading);
      const rightZ = -Math.sin(raceDrive.heading);
      let cameraX: number;
      let cameraY: number;
      let cameraZ: number;
      let lookX: number;
      let lookY: number;
      let lookZ: number;

      if (elapsed < 1.5) {
        // Angle 1: low right-front quarter, framed on the front wheel/body.
        const sweep = elapsed / 1.5;
        cameraX = raceDrive.x + camForward.x * (0.3 + sweep * 0.18) + rightX * (3.9 - sweep * 0.22);
        cameraY = raceDrive.y + 0.42;
        cameraZ = raceDrive.z + camForward.z * (0.3 + sweep * 0.18) + rightZ * (3.9 - sweep * 0.22);
        lookX = raceDrive.x + camForward.x * 1.4 + rightX * 0.62;
        lookY = raceDrive.y + 0.74;
        lookZ = raceDrive.z + camForward.z * 1.4 + rightZ * 0.62;
      } else if (elapsed < 3) {
        // Angle 2: a hard cut to the left profile, then a gentle pan toward
        // the front quarter to show the side paint and temporary underglow.
        const progress = (elapsed - 1.5) / 1.5;
        const eased = progress * progress * (3 - 2 * progress);
        const angle = -Math.PI / 2 + 0.24 * eased;
        const forwardOffset = Math.cos(angle) * 4.6;
        const rightOffset = Math.sin(angle) * 4.6;
        cameraX = raceDrive.x + camForward.x * forwardOffset + rightX * rightOffset;
        cameraY = raceDrive.y + 0.48 + eased * 0.08;
        cameraZ = raceDrive.z + camForward.z * forwardOffset + rightZ * rightOffset;
        lookX = raceDrive.x + camForward.x * 0.16;
        lookY = raceDrive.y + 0.72;
        lookZ = raceDrive.z + camForward.z * 0.16;
      } else if (elapsed < 4.2) {
        // Angle 3: eagle-eye establishing shot, centered on the player and both
        // opponents so the complete starting formation is visible at once.
        const gridCenterX = (raceDrive.x + raceAi.x[0] + raceAi.x[1]) / 3;
        const gridCenterY = (raceDrive.y + raceAi.y[0] + raceAi.y[1]) / 3;
        const gridCenterZ = (raceDrive.z + raceAi.z[0] + raceAi.z[1]) / 3;
        cameraX = gridCenterX - camForward.x * 7 + rightX * 7;
        cameraY = gridCenterY + 15;
        cameraZ = gridCenterZ - camForward.z * 7 + rightZ * 7;
        lookX = gridCenterX + camForward.x * 0.5;
        lookY = gridCenterY + 0.4;
        lookZ = gridCenterZ + camForward.z * 0.5;
      } else if (elapsed < 5.7) {
        // Angle 4: third-person rear chase framing, looking forward toward the grid.
        cameraX = raceDrive.x - camForward.x * 6.5;
        cameraY = raceDrive.y + 2;
        cameraZ = raceDrive.z - camForward.z * 6.5;
        lookX = raceDrive.x + camForward.x * 11.5;
        lookY = raceDrive.y + 1;
        lookZ = raceDrive.z + camForward.z * 11.5;
      } else if (elapsed < 6.2) {
        // Blend from the rear third-person shot into the main chase rig over half a second.
        const progress = (elapsed - 5.7) / 0.5;
        const eased = progress * progress * (3 - 2 * progress);
        const rearX = raceDrive.x - camForward.x * 6.5;
        const rearY = raceDrive.y + 2;
        const rearZ = raceDrive.z - camForward.z * 6.5;
        const chaseX = raceDrive.x - camForward.x * CAM.base;
        const chaseY = raceDrive.y + CAM.height;
        const chaseZ = raceDrive.z - camForward.z * CAM.base;
        cameraX = rearX + (chaseX - rearX) * eased;
        cameraY = rearY + (chaseY - rearY) * eased;
        cameraZ = rearZ + (chaseZ - rearZ) * eased;
        lookX = raceDrive.x + camForward.x * 11.5 + (raceDrive.x + camForward.x * CAM.look - (raceDrive.x + camForward.x * 11.5)) * eased;
        lookY = raceDrive.y + 1 + (raceDrive.y + 1.05 - (raceDrive.y + 1)) * eased;
        lookZ = raceDrive.z + camForward.z * 11.5 + (raceDrive.z + camForward.z * CAM.look - (raceDrive.z + camForward.z * 11.5)) * eased;
      } else {
        const chaseX = raceDrive.x - camForward.x * CAM.base;
        const chaseY = raceDrive.y + CAM.height;
        const chaseZ = raceDrive.z - camForward.z * CAM.base;
        camera.position.set(chaseX, chaseY, chaseZ);
        camLook.set(
          raceDrive.x + camForward.x * CAM.look,
          raceDrive.y + 1.05,
          raceDrive.z + camForward.z * CAM.look,
        );
        camera.lookAt(camLook);
        // Finish the camera move first. Start the countdown/audio on the next
        // frame so no red light or gameplay HUD overlaps the cinematic shot.
        cinematic.current = false;
        countdownPending.current = true;
        clock.current = 0;
        frameGate.current.last = performance.now();
        settled.current = true;
        requestNextRaceFrame(state, frameGate.current);
        return;
      }

      camera.position.set(cameraX, cameraY, cameraZ);
      camLook.set(lookX, lookY, lookZ);
      camera.lookAt(camLook);
      requestNextRaceFrame(state, frameGate.current);
      return;
    }

    if (countdownPending.current) {
      countdownPending.current = false;
      releaseKeys();
      startRaceSequence();
      onCinematicComplete();
    }

    clock.current += delta;

    // Analogue ramps: a tap is a tap, a hold is a hold.
    raceInput.throttle = held.forward ? 1 : 0;
    raceInput.brake = held.back ? 1 : 0;
    raceInput.steer = (held.left ? 1 : 0) - (held.right ? 1 : 0);
    raceInput.handbrake = held.drift || held.handbrake;

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

    const orbit = raceSession.camMode === 0 && phase === "finished";
    const leftX = -Math.cos(raceDrive.heading);
    const leftZ = Math.sin(raceDrive.heading);

    if (orbit) {
      // Slow hero orbit around the winner at the podium.
      const angle = clock.current * 0.26;
      const radius = 15;
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
    // World-up lookAt keeps the horizon upright without rotating the camera's
    // Euler angles directly (which can introduce a 90-degree view flip).

    // Nitro punch: the pulse is driven by the engine's boost envelope.
    const fov = mount.fov + raceDrive.boostFx * 15 + Math.min(speed, 84) * 0.11;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    requestNextRaceFrame(state, frameGate.current);
  }, -6);

  return null;
});
