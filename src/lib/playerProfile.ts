export type PlayerProfile = {
  displayName: string;
  level: number;
  rank: string;
};

const PROFILE_STORAGE_KEY = "city-speedrunners-player-profile";
const DEFAULT_PROFILE: PlayerProfile = {
  displayName: "Guest Racer",
  level: 1,
  rank: "ROOKIE",
};

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return DEFAULT_PROFILE.displayName;
  const trimmed = value.replace(/[<>\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ").slice(0, 20);
  return trimmed || DEFAULT_PROFILE.displayName;
}

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const stored = JSON.parse(raw);
    return {
      displayName: normalizeDisplayName(stored?.displayName),
      level: Number.isInteger(stored?.level) ? Math.max(1, Math.min(99, stored.level)) : 1,
      rank: typeof stored?.rank === "string" ? stored.rank.slice(0, 16).toUpperCase() : DEFAULT_PROFILE.rank,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function savePlayerProfile(profile: Partial<PlayerProfile>): PlayerProfile {
  const safe: PlayerProfile = {
    displayName: normalizeDisplayName(profile.displayName),
    level: Number.isInteger(profile.level) ? Math.max(1, Math.min(99, profile.level as number)) : 1,
    rank: typeof profile.rank === "string" ? profile.rank.slice(0, 16).toUpperCase() : DEFAULT_PROFILE.rank,
  };
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // The guest profile still works in-memory when browser storage is blocked.
  }
  return safe;
}

export function getAvatarInitials(displayName: string) {
  const parts = normalizeDisplayName(displayName).split(" ").filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}
