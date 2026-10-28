// @ts-nocheck
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { playEngineStartSound, resumeAudio, stopEngineStartSound, updateAudio } from "./raceAudio";
import { cityDrive, cityInput, releaseCityKeys, selectCityGear, shiftCityGear, startCityDrive, stepCityDrive, stopCityDrive, toggleCityEngine } from "./cityDrive";

const cameraGoal = new Vector3();
const cameraLook = new Vector3();
const cameraForward = new Vector3();
const cameraMatrix = new Matrix4();
const cameraOrientation = new Quaternion();
const CAMERA_MOUNTS = [
  { behind: 8.6, height: 3.0, look: 9.5, fov: 64 },
  { behind: -0.85, height: 1.22, look: 18, fov: 72 },
];

export function CityDriveDirector({ onExit, onToggleHeadlights, carId = "sf90" }) {
  const { camera, invalidate } = useThree();
  const mount = useRef(0);
  const ready = useRef(false);
  const previousFar = useRef(camera.far);
  const previousFov = useRef(camera.fov);

  useLayoutEffect(() => {
    startCityDrive(carId);
    ready.current = true;
    camera.far = 800;
    camera.updateProjectionMatrix();
    invalidate();
    return () => {
      ready.current = false;
      camera.far = previousFar.current;
      camera.fov = previousFov.current;
      camera.updateProjectionMatrix();
      releaseCityKeys();
      stopCityDrive();
    };
  }, [camera, invalidate, carId]);

  useEffect(() => {
    const setKey = (code, down) => {
      switch (code) {
        case "KeyW":
        case "ArrowUp": cityInput.forward = down; break;
        case "KeyS":
        case "ArrowDown": cityInput.brake = down; break;
        case "KeyA":
        case "ArrowLeft": cityInput.left = down; break;
        case "KeyD":
        case "ArrowRight": cityInput.right = down; break;
        case "Space":
        case "ShiftLeft":
        case "ShiftRight": cityInput.handbrake = down; break;
        default: return false;
      }
      return true;
    };
    const keydown = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (event.code === "Escape") {
        event.preventDefault();
        onExit();
        return;
      }
      if (event.code === "KeyQ") {
        shiftCityGear(-1);
        return;
      }
      if (event.code === "KeyE") {
        shiftCityGear(1);
        return;
      }
      if (event.code === "KeyN") {
        selectCityGear(0);
        return;
      }
      if (event.code === "KeyR") {
        selectCityGear(-1);
        return;
      }
      if (event.code === "KeyI") {
        toggleEngineWithSound();
        return;
      }
      if (event.code === "KeyC") {
        mount.current = (mount.current + 1) % CAMERA_MOUNTS.length;
        return;
      }
      if (event.code === "KeyL") {
        onToggleHeadlights();
        return;
      }
      if (!setKey(event.code, true)) return;
      if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
    };
    const keyup = (event) => setKey(event.code, false);
    const toggleEngineWithSound = () => {
      const wasRunning = cityDrive.engineRunning;
      if (!toggleCityEngine()) return;
      if (!wasRunning && cityDrive.engineRunning) playEngineStartSound();
      else stopEngineStartSound();
    };
    const blur = () => releaseCityKeys();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
    };
  }, [onExit, onToggleHeadlights]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) {
        resumeAudio();
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [invalidate]);

  useFrame((state, delta) => {
    if (!ready.current || document.hidden) return;
    stepCityDrive(delta);
    const forwardX = -Math.sin(cityDrive.heading);
    const forwardZ = -Math.cos(cityDrive.heading);
    const activeMount = CAMERA_MOUNTS[mount.current];
    cameraForward.set(forwardX, 0, forwardZ);
    cameraGoal.set(
      cityDrive.x - cameraForward.x * activeMount.behind,
      cityDrive.y + activeMount.height,
      cityDrive.z - cameraForward.z * activeMount.behind,
    );
    cameraLook.set(
      cityDrive.x + cameraForward.x * activeMount.look,
      cityDrive.y + 1.15,
      cityDrive.z + cameraForward.z * activeMount.look,
    );
    const damping = Math.min(1, 1 - Math.exp(-8.5 * Math.min(delta, 0.05)));
    camera.position.lerp(cameraGoal, damping);
    cameraMatrix.lookAt(camera.position, cameraLook, camera.up);
    cameraOrientation.setFromRotationMatrix(cameraMatrix);
    camera.quaternion.slerp(cameraOrientation, damping);
    const targetFov = activeMount.fov + Math.min(8, Math.abs(cityDrive.speed) * 0.16);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = MathUtils.damp(camera.fov, targetFov, 3.5, Math.min(delta, 0.05));
      camera.updateProjectionMatrix();
    }
    updateAudio(delta, cityDrive.engineRunning);
    state.invalidate();
  }, -6);

  return null;
}
