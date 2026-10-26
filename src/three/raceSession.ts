// @ts-nocheck
/**
 * Race session settings: the weather preset and the camera mount.
 *
 * Both are module level singletons read straight inside `useFrame`, so cycling
 * them never re-renders React or the canvas. The only React consumers are the
 * HUD buttons, which subscribe to the change events.
 *
 * Performance contract for the presets below: they ONLY re-tune the four lights
 * that already exist (hemisphere + ambient + key + rim) plus the four pooled
 * lamp lights and the shared fog. No preset ever adds a light, so the fragment
 * shader variant for the circuit never changes and no material is recompiled.
 */

export interface EnvPreset {
  id: "day" | "night" | "rain";
  label: string;
  /** Key into the cached sky textures. */
  sky: "day" | "night" | "rain";
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  keyColor: string;
  keyIntensity: number;
  rimColor: string;
  rimIntensity: number;
  /** Pooled street lamp point lights (0 in daylight). */
  lampIntensity: number;
  poolOpacity: number;
  markingEmissive: string;
  markingEmissiveIntensity: number;
  cityColor: string;
  cityEmissive: string;
  cityEmissiveIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  /** 0 = dry, 1 = full rain volume. */
  rain: number;
}

export const ENVIRONMENTS: EnvPreset[] = [
  {
    id: "day",
    label: "Day",
    sky: "day",
    hemiSky: "#bcd9ff",
    hemiGround: "#5f5545",
    hemiIntensity: 1.25,
    ambientColor: "#dcebff",
    ambientIntensity: 0.5,
    keyColor: "#fff2dd",
    keyIntensity: 3.3,
    rimColor: "#c2d8ff",
    rimIntensity: 0.6,
    lampIntensity: 0,
    poolOpacity: 0.02,
    markingEmissive: "#000000",
    markingEmissiveIntensity: 0,
    cityColor: "#8b97a9",
    cityEmissive: "#000000",
    cityEmissiveIntensity: 0,
    fogColor: "#c3d8f0",
    fogNear: 90,
    fogFar: 900,
    rain: 0,
  },
  {
    id: "night",
    label: "Night",
    sky: "night",
    hemiSky: "#41597f",
    hemiGround: "#080a10",
    hemiIntensity: 0.5,
    ambientColor: "#2c3852",
    ambientIntensity: 0.24,
    keyColor: "#cfe0ff",
    keyIntensity: 2.1,
    rimColor: "#5b7fd8",
    rimIntensity: 0.55,
    lampIntensity: 36,
    poolOpacity: 0.34,
    markingEmissive: "#1b2740",
    markingEmissiveIntensity: 0.32,
    cityColor: "#0d1220",
    cityEmissive: "#12203c",
    cityEmissiveIntensity: 0.55,
    fogColor: "#080d18",
    fogNear: 40,
    fogFar: 520,
    rain: 0,
  },
  {
    id: "rain",
    label: "Rain / Fog",
    sky: "rain",
    hemiSky: "#2b3a52",
    hemiGround: "#05070c",
    hemiIntensity: 0.35,
    ambientColor: "#1a2436",
    ambientIntensity: 0.3,
    keyColor: "#9fb6d8",
    keyIntensity: 0.9,
    rimColor: "#3f5f9c",
    rimIntensity: 0.32,
    lampIntensity: 18,
    poolOpacity: 0.24,
    markingEmissive: "#16203a",
    markingEmissiveIntensity: 0.25,
    cityColor: "#0a0f18",
    cityEmissive: "#0d1830",
    cityEmissiveIntensity: 0.4,
    fogColor: "#151b24",
    fogNear: 14,
    fogFar: 165,
    rain: 1,
  },
];

export const CAMERA_MODES = [
  { id: "chase", label: "Chase" },
  { id: "hood", label: "Hood" },
  { id: "cockpit", label: "Cockpit" },
];

/** Night is the tuned default, so index 1 keeps the original circuit look. */
export const raceSession = {
  envIndex: 1,
  camMode: 0,
};

const listeners = new Set<(session: typeof raceSession) => void>();

export function subscribeRaceSession(listener: (session: typeof raceSession) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  for (const listener of listeners) listener(raceSession);
}

/** Current preset — returns the shared object, never allocates. */
export function currentEnv(): EnvPreset {
  return ENVIRONMENTS[raceSession.envIndex];
}

export function setEnvironment(index: number) {
  const next = ((index % ENVIRONMENTS.length) + ENVIRONMENTS.length) % ENVIRONMENTS.length;
  if (next === raceSession.envIndex) return;
  raceSession.envIndex = next;
  emit();
}

export function cycleEnvironment() {
  setEnvironment(raceSession.envIndex + 1);
}

export function setCameraMode(mode: number) {
  const next = ((mode % CAMERA_MODES.length) + CAMERA_MODES.length) % CAMERA_MODES.length;
  if (next === raceSession.camMode) return;
  raceSession.camMode = next;
  emit();
}

export function cycleCamera() {
  setCameraMode(raceSession.camMode + 1);
}
