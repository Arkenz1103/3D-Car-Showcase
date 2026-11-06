export type GraphicsQuality = "low" | "standard" | "high";

export type GarageSaveData = {
  version: 1;
  garageCarIds: string[];
  selectedCarId: string;
  customization: {
    paintHex: string;
    paintFinishId: string;
    wheelSwatchId: string;
    caliperSwatchId: string;
    interiorSwatchId: string;
    studioThemeId: string;
    matteCarbon: boolean;
  };
  settings: {
    graphicsQuality: GraphicsQuality;
    garageLightsOn: boolean;
    vehicleLightsOn: boolean;
    neonLightsOn: boolean;
    autoOrbit: boolean;
    raceMapId: string;
    raceEnvironment: number;
    raceDifficulty: "easy" | "normal" | "hard";
  };
};

export const DEFAULT_GARAGE_SAVE: GarageSaveData = {
  version: 1,
  garageCarIds: ["sf90", "aventador", "mclaren-vgt"],
  selectedCarId: "sf90",
  customization: {
    paintHex: "#CE1318",
    paintFinishId: "gloss",
    wheelSwatchId: "grigio-corsa",
    caliperSwatchId: "giallo",
    interiorSwatchId: "nero-leather",
    studioThemeId: "forged",
    matteCarbon: false,
  },
  settings: {
    graphicsQuality: "standard",
    garageLightsOn: true,
    vehicleLightsOn: false,
    neonLightsOn: false,
    autoOrbit: false,
    raceMapId: "manila",
    raceEnvironment: 0,
    raceDifficulty: "normal",
  },
};

export function normalizeGarageSave(value: unknown): GarageSaveData {
  const raw = value && typeof value === "object" ? value as Partial<GarageSaveData> : {};
  const customization = raw.customization ?? DEFAULT_GARAGE_SAVE.customization;
  const settings = raw.settings ?? DEFAULT_GARAGE_SAVE.settings;
  const graphicsQuality: GraphicsQuality = ["low", "standard", "high"].includes(settings.graphicsQuality)
    ? settings.graphicsQuality
    : DEFAULT_GARAGE_SAVE.settings.graphicsQuality;
  const carIds = Array.isArray(raw.garageCarIds)
    ? [...new Set(raw.garageCarIds.filter((id): id is string => typeof id === "string" && id.length <= 40))]
    : DEFAULT_GARAGE_SAVE.garageCarIds;
  return {
    version: 1,
    garageCarIds: carIds.length ? carIds : [...DEFAULT_GARAGE_SAVE.garageCarIds],
    selectedCarId: typeof raw.selectedCarId === "string" ? raw.selectedCarId : DEFAULT_GARAGE_SAVE.selectedCarId,
    customization: {
      paintHex: /^#[0-9a-f]{6}$/i.test(customization.paintHex) ? customization.paintHex : DEFAULT_GARAGE_SAVE.customization.paintHex,
      paintFinishId: typeof customization.paintFinishId === "string" ? customization.paintFinishId : DEFAULT_GARAGE_SAVE.customization.paintFinishId,
      wheelSwatchId: typeof customization.wheelSwatchId === "string" ? customization.wheelSwatchId : DEFAULT_GARAGE_SAVE.customization.wheelSwatchId,
      caliperSwatchId: typeof customization.caliperSwatchId === "string" ? customization.caliperSwatchId : DEFAULT_GARAGE_SAVE.customization.caliperSwatchId,
      interiorSwatchId: typeof customization.interiorSwatchId === "string" ? customization.interiorSwatchId : DEFAULT_GARAGE_SAVE.customization.interiorSwatchId,
      studioThemeId: typeof customization.studioThemeId === "string" ? customization.studioThemeId : DEFAULT_GARAGE_SAVE.customization.studioThemeId,
      matteCarbon: Boolean(customization.matteCarbon),
    },
    settings: {
      graphicsQuality,
      garageLightsOn: settings.garageLightsOn !== false,
      vehicleLightsOn: Boolean(settings.vehicleLightsOn),
      neonLightsOn: Boolean(settings.neonLightsOn),
      autoOrbit: Boolean(settings.autoOrbit),
      raceMapId: typeof settings.raceMapId === "string" ? settings.raceMapId : DEFAULT_GARAGE_SAVE.settings.raceMapId,
      raceEnvironment: Number.isInteger(settings.raceEnvironment) ? Math.max(0, Math.min(2, settings.raceEnvironment)) : 0,
      raceDifficulty: ["easy", "normal", "hard"].includes(settings.raceDifficulty) ? settings.raceDifficulty : "normal",
    },
  };
}

const GUEST_SAVE_STORAGE_KEY = "city-speedrunners-guest-garage-save";

export function loadGuestGarageSave(): GarageSaveData {
  try {
    const raw = window.sessionStorage.getItem(GUEST_SAVE_STORAGE_KEY);
    return raw ? normalizeGarageSave(JSON.parse(raw)) : normalizeGarageSave(DEFAULT_GARAGE_SAVE);
  } catch {
    return normalizeGarageSave(DEFAULT_GARAGE_SAVE);
  }
}

export function storeGuestGarageSave(value: unknown): GarageSaveData {
  const safe = normalizeGarageSave(value);
  try {
    window.sessionStorage.setItem(GUEST_SAVE_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // Keep the current garage usable in memory if session storage is blocked.
  }
  return safe;
}

export function clearGuestGarageSave() {
  try {
    window.sessionStorage.removeItem(GUEST_SAVE_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; sign-out remains possible.
  }
}

export function mergeGarageSaves(cloudValue: unknown, guestValue: unknown): GarageSaveData {
  const cloud = normalizeGarageSave(cloudValue);
  const guest = normalizeGarageSave(guestValue);
  return normalizeGarageSave({
    ...cloud,
    ...guest,
    garageCarIds: [...new Set([...cloud.garageCarIds, ...guest.garageCarIds])],
    customization: { ...cloud.customization, ...guest.customization },
    settings: { ...cloud.settings, ...guest.settings },
  });
}
