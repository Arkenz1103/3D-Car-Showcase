import { loadVehicleAsset } from "@/lib/gltf";

/** Extra race-only rivals; these are intentionally not player-selectable garage cars. */
const RACE_MODEL_BASE_URL = `${import.meta.env.BASE_URL}models/race/`;

export const RACE_OPPONENT_CARS = [
  {
    id: "porsche-911-turbo-930",
    brand: "Porsche",
    model: "911 Turbo (930)",
    year: "1975",
    shortTitle: "911 Turbo",
    assetUrl: `${RACE_MODEL_BASE_URL}porsche-911-turbo-1975.glb`,
    rotationY: Math.PI,
    targetLength: 4.291,
    isSF90Reference: false,
    defaultPaintHex: "#E5C943",
    accentHex: "#E5C943",
    license: {
      title: "FREE 1975 Porsche 911 (930) Turbo",
      author: "Lionsharp Studios",
      license: "CC BY 4.0",
      source: "https://sketchfab.com/3d-models/free-1975-porsche-911-930-turbo-8568d9d14a994b9cae59499f0dbed21e",
      note: "Optimized meshopt/WebP GLB; scaled to the published 4.291 m length.",
    },
  },
  {
    id: "bugatti-chiron",
    brand: "Bugatti",
    model: "Chiron",
    year: "2017",
    shortTitle: "Chiron",
    assetUrl: `${RACE_MODEL_BASE_URL}bugatti-chiron.glb`,
    rotationY: Math.PI,
    targetLength: 4.544,
    isSF90Reference: false,
    defaultPaintHex: "#155CC2",
    accentHex: "#155CC2",
    license: {
      title: "Bugatti Chiron 2017",
      author: "apexmesh; original modeling credited to Bob Kimani (Kimz Auto)",
      license: "CC BY-NC",
      source: "https://blendswap.com/blend/32484",
      note: "Non-commercial use only. Optimized race GLB; scaled to 4.544 m.",
    },
  },
];

let warmPromise: Promise<void> | null = null;

/** Warm the shared source cache sequentially while the player chooses race settings. */
export function warmRaceOpponentModels() {
  if (warmPromise) return warmPromise;
  warmPromise = (async () => {
    for (const car of RACE_OPPONENT_CARS) {
      try {
        await loadVehicleAsset(null, null, car, { accelerateRaycast: false });
      } catch {
        // Racing remains available; RaceOpponents will retry and skip failed assets.
      }
    }
  })().finally(() => {
    warmPromise = null;
  });
  return warmPromise;
}
