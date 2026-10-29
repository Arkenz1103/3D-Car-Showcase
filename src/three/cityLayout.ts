// Shared, deterministic road/building layout for rendering and free-drive collision.
export const CITY_END_Z = 480;
// Begin the boulevard beyond the roller door; the apron remains the garage exit.
export const CITY_START_Z = 12;

export type RoadPoint = { x: number; z: number; y: number };
export type CityRoad = { id: string; width: number; points: RoadPoint[] };
type CityInstance = {
  x: number; y: number; z: number; sx: number; sy: number; sz: number;
  color: string; side?: number; ry?: number; rx?: number; rz?: number;
};

const point = (x: number, z: number, y = 0): RoadPoint => ({ x, z, y });

export const CITY_ROADS: CityRoad[] = [
  { id: "boulevard", width: 18, points: [point(0, CITY_START_Z), point(0, CITY_END_Z)] },
  { id: "west-avenue", width: 14, points: [point(-62, 24), point(-62, 448)] },
  { id: "east-avenue", width: 14, points: [point(62, 24), point(62, 448)] },
  ...[76, 124, 172, 220, 268, 316, 364, 412, 460].map((z, index) => ({
    id: `cross-street-${index + 1}`,
    width: 14,
    points: [point(-98, z), point(98, z)],
  })),
  {
    id: "beach-road",
    width: 13,
    points: [point(0, 96), point(0, 110), point(2, 118), point(8, 124), point(18, 127), point(28, 128), point(36, 132), point(43, 147), point(58, 160), point(82, 164), point(110, 164), point(126, 164)],
  },
  {
    // A broad paved connector gives drivers room to make the city-to-hill turn.
    id: "mountain-connector",
    width: 17,
    points: [
      point(0, 188), point(0, 204), point(-2, 212), point(-8, 218), point(-17, 221),
      point(-25, 225), point(-31, 231, 1),
    ],
  },
  {
    id: "mountain-road",
    width: 11,
    points: [
      point(-31, 231, 1), point(-34, 247, 3), point(-46, 262, 6),
      point(-58, 278, 10), point(-70, 291, 14), point(-68, 309, 18),
      point(-82, 325, 23), point(-96, 342, 28), point(-113, 356, 33),
      point(-129, 375, 39), point(-145, 399, 46), point(-164, 418, 53),
      point(-181, 442, 60),
    ],
  },
  {
    id: "bridge-road",
    width: 14,
    points: [
      point(98, 364), point(110, 364), point(124, 364, 4), point(180, 364, 4),
      point(196, 364, 4), point(210, 364), point(222, 364), point(230, 380),
      point(212, 398), point(198, 412), point(182, 412), point(166, 412),
      point(150, 412, 1), point(138, 412, 4), point(110, 412, 4), point(98, 412),
    ],
  },
];

export const CITY_JUNCTIONS: CityInstance[] = [];
for (const z of [76, 124, 172, 220, 268, 316, 364, 412, 460]) {
  CITY_JUNCTIONS.push({ x: 0, y: 0.02, z, sx: z === 124 || z === 220 || z === 364 ? 36 : 25, sy: 0.04, sz: z === 124 || z === 220 || z === 364 ? 36 : 25, color: "#303538" });
  for (const x of [-62, 62]) CITY_JUNCTIONS.push({ x, y: 0.02, z, sx: 21, sy: 0.04, sz: 21, color: "#303538" });
}
for (const [x, z, diameter] of [[98, 364, 28], [98, 412, 28], [230, 380, 26], [198, 412, 24]]) {
  CITY_JUNCTIONS.push({ x, y: 0.02, z, sx: diameter, sy: 0.04, sz: diameter, color: "#303538" });
}

export const CITY_BUILDINGS: CityInstance[] = [];
export const CITY_SKYLINE: CityInstance[] = [];
export const CITY_BUILDING_PODIUMS: CityInstance[] = [];
export const CITY_BUILDING_CROWNS: CityInstance[] = [];
export const CITY_WINDOWS: CityInstance[] = [];
export const CITY_WINDOWS_WARM: CityInstance[] = [];
export const CITY_ROOF_UNITS: CityInstance[] = [];
export const CITY_ROOF_TANKS: CityInstance[] = [];
export const CITY_FIRE_ESCAPES: CityInstance[] = [];
export const CITY_NEON_CYAN: CityInstance[] = [];
export const CITY_NEON_WARM: CityInstance[] = [];
export const CITY_SIDEWALKS: CityInstance[] = [];
export const CITY_PARKS: CityInstance[] = [];
export const CITY_MARKINGS: CityInstance[] = [];
export const CITY_LAMPS: CityInstance[] = [];
export const CITY_TREES: CityInstance[] = [];
export const CITY_HILLS: CityInstance[] = [];
export const CITY_BRIDGE_PIERS: CityInstance[] = [];
export const CITY_BRIDGE_RAILS: CityInstance[] = [];
export const CITY_BEACH_FEATURES: CityInstance[] = [];

// A restrained material palette mixes Manhattan masonry with glass-and-steel
// towers inspired by Hong Kong's harbourfront skyline.
const buildingPalette = [
  "#536572", // blue glass
  "#765d50", // warm brick
  "#827b70", // limestone
  "#435e68", // teal curtain wall
  "#6c6a67", // concrete
  "#596271", // charcoal glass
];
const blockCenters = [44, 100, 148, 196, 244, 292, 340, 388, 436];
const windowWarmColors = ["#f1bd78", "#f4d49b", "#e99c62"];

function addWindow(face: CityInstance, seed: number) {
  const isWarm = seed % 17 === 0 || seed % 29 === 0;
  const window = { ...face, color: isWarm ? windowWarmColors[seed % windowWarmColors.length] : (seed % 7 === 0 ? "#87b7ce" : "#354b5b") };
  (isWarm ? CITY_WINDOWS_WARM : CITY_WINDOWS).push(window);
}

function addCityBuilding({ x, z, width, depth, height, streetSide, block, style, hongKong = false }: {
  x: number; z: number; width: number; depth: number; height: number;
  streetSide: number; block: number; style: number; hongKong?: boolean;
}) {
  const color = buildingPalette[style % buildingPalette.length];
  const building = { x, y: height / 2, z, sx: width, sy: height, sz: depth, color, side: streetSide };
  CITY_BUILDINGS.push(building);

  const podiumHeight = Math.min(6.4, height * 0.16);
  CITY_BUILDING_PODIUMS.push({ x, y: podiumHeight / 2, z, sx: width + 1.8, sy: podiumHeight, sz: depth + 1.6, color: style % 2 === 1 ? "#4d4845" : "#51575b" });
  if (height > 48) {
    CITY_BUILDING_CROWNS.push({ x, y: height - 2.1, z, sx: width * 0.72, sy: 4.2, sz: depth * 0.72, color });
    CITY_BUILDING_CROWNS.push({ x, y: height + 0.6, z, sx: width * 0.38, sy: 1.2, sz: depth * 0.44, color: "#42484d" });
  }

  const frontX = x - streetSide * (width / 2 + 0.055);
  const frontRotation = streetSide > 0 ? -Math.PI / 2 : Math.PI / 2;
  const floors = Math.max(3, Math.floor((height - 8) / 3.7));
  const frontColumns = Math.max(4, Math.floor(depth / 3.6));
  const sideColumns = Math.max(4, Math.floor(width / 3.8));
  for (let floor = 0; floor < floors; floor++) {
    const y = 6.1 + floor * 3.65;
    if (y > height - 2.5) break;
    for (let pane = 0; pane < frontColumns; pane++) {
      const zPane = z - depth / 2 + 2.1 + pane * (depth - 4.2) / Math.max(1, frontColumns - 1);
      const seed = block * 89 + style * 31 + floor * 17 + pane * 7;
      addWindow({ x: frontX, y, z: zPane, sx: 2.05, sy: 1.5, sz: 0.075, ry: frontRotation, color }, seed);
      const backX = x + streetSide * (width / 2 + 0.055);
      addWindow({ x: backX, y, z: zPane, sx: 2.05, sy: 1.5, sz: 0.075, ry: -frontRotation, color }, seed + 3);
    }
    for (let pane = 0; pane < sideColumns; pane++) {
      const xPane = x - width / 2 + 2.1 + pane * (width - 4.2) / Math.max(1, sideColumns - 1);
      const seed = block * 97 + style * 19 + floor * 13 + pane * 11;
      addWindow({ x: xPane, y, z: z - depth / 2 - 0.055, sx: 2.05, sy: 1.5, sz: 0.075, color }, seed);
      addWindow({ x: xPane, y, z: z + depth / 2 + 0.055, sx: 2.05, sy: 1.5, sz: 0.075, ry: Math.PI, color }, seed + 5);
    }
  }

  // Compact rooftop plant is instanced with every other roof unit, not a
  // separate mesh per tower. Brick rooftops get recognizable water tanks.
  CITY_ROOF_UNITS.push(
    { x: x - width * 0.22, y: height + 0.65, z: z - depth * 0.2, sx: 3.0, sy: 1.3, sz: 2.4, color: "#41484d" },
    { x: x + width * 0.19, y: height + 0.48, z: z + depth * 0.2, sx: 2.2, sy: 0.96, sz: 2.8, color: "#53575a" },
  );
  if (style === 1 || block % 4 === 0) {
    CITY_ROOF_TANKS.push({ x: x + streetSide * width * 0.19, y: height + 1.45, z, sx: 1.8, sy: 2.4, sz: 1.8, color: "#59473c" });
  }

  // Fire escapes and cornices give the brick mid-rises a New York street-wall character.
  if (style === 1) {
    const escapeCount = Math.min(4, Math.floor((height - 10) / 9));
    for (let level = 0; level < escapeCount; level++) {
      const escapeY = 7 + level * 8.4;
      const escapeZ = z + depth * 0.23;
      CITY_FIRE_ESCAPES.push(
        { x: frontX - streetSide * 0.48, y: escapeY, z: escapeZ, sx: 1.05, sy: 0.16, sz: 4.4, color: "#363b3d" },
        { x: frontX - streetSide * 0.92, y: escapeY - 1.2, z: escapeZ + 1.85, sx: 0.12, sy: 2.4, sz: 0.12, color: "#424749" },
      );
    }
  }

  // Vertical neon bars and signboards concentrate in the eastern harbour district.
  if (hongKong) {
    CITY_NEON_CYAN.push({ x: frontX - streetSide * 0.16, y: Math.min(height * 0.56, 24), z: z - depth * 0.18, sx: 0.18, sy: 13, sz: 1.0, color: "#8df7ee" });
    CITY_NEON_WARM.push({ x: frontX - streetSide * 0.18, y: Math.min(height * 0.43, 19), z: z + depth * 0.22, sx: 0.2, sy: 10, sz: 1.25, color: "#ff7586" });
  }
}

// Dense mixed-use blocks flank the main boulevard. Secondary rows fill the
// avenue blocks while leaving every connected route and junction unobstructed.
for (let block = 0; block < blockCenters.length; block++) {
  const z = blockCenters[block];
  for (const side of [-1, 1]) {
    const primaryStyle = block % 4 === 0 ? 2 : block % 3 === 1 ? 1 : block % 3 === 2 ? 3 : 0;
    const primaryHeight = [53, 66, 58, 76, 62, 84, 71, 64, 55][block] + (side > 0 ? 5 : 0);
    // Leave the western midtown corner open for the mountain-road switchback.
    if (!(side < 0 && block === 4)) {
      addCityBuilding({ x: side * 20.2, z: z + (side > 0 ? 4 : -3), width: 18, depth: 27, height: primaryHeight, streetSide: side, block, style: primaryStyle, hongKong: side > 0 && block >= 2 && block <= 6 });
    }

    // Brownstones / office mid-rises create a finer Manhattan-like street wall.
    const skipInnerInfill = (side > 0 && block === 2) || (side < 0 && block === 4);
    if (!skipInnerInfill) {
      const infillStyle = block % 2 === 0 ? 1 : 4;
      addCityBuilding({ x: side * 42.5, z: z + (side > 0 ? -4 : 4), width: 17, depth: 23, height: 29 + ((block * 7) % 5) * 5, streetSide: -side, block: block + 9, style: infillStyle, hongKong: side > 0 && block >= 3 && block <= 5 });
    }

    // Outer avenue blocks build a continuous skyline but step away from the
    // beach connector and elevated bridge approach.
    const skipOuterForRoute = (side > 0 && block === 2) || block === 6 || block === 7;
    if (!skipOuterForRoute) {
      const outerStyle = block % 3 === 0 ? 2 : block % 3 === 1 ? 4 : 0;
      addCityBuilding({ x: side * 83.5, z: z + (side > 0 ? 3 : -3), width: 22, depth: 25, height: 32 + ((block * 11 + (side > 0 ? 3 : 0)) % 5) * 6, streetSide: side, block: block + 18, style: outerStyle, hongKong: side > 0 && block >= 4 && block <= 6 });
    }
  }
}

// Distant high-rise banks frame the harbour and add layered skyline depth.
// These are visual-only silhouettes outside the drivable road corridors.
for (let index = 0; index < 18; index++) {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  const x = side * (154 + (row % 4) * 15);
  const z = 34 + Math.floor(row / 4) * 70 + (row % 2) * 12;
  const width = 15 + (row % 3) * 4;
  const depth = 18 + (row % 2) * 7;
  const height = 58 + ((row * 17 + (side > 0 ? 11 : 0)) % 7) * 12;
  CITY_SKYLINE.push({ x, y: height / 2, z, sx: width, sy: height, sz: depth, color: buildingPalette[(row + 3) % buildingPalette.length] });
  if (height > 95) CITY_SKYLINE.push({ x, y: height + 2.5, z, sx: width * 0.72, sy: 5, sz: depth * 0.7, color: "#52636d" });
}

// Raised stone sidewalks, patterned crossings, and tactile corner pads.
for (const side of [-1, 1]) {
  for (let block = 0; block < blockCenters.length; block++) {
    const z = blockCenters[block];
    const nextZ = block === 0 ? 76 : 124 + (block - 1) * 48;
    const length = Math.max(18, nextZ - z - 9);
    CITY_SIDEWALKS.push(
      { x: side * 10.25, y: 0.012, z: z + length * 0.42, sx: 2.35, sy: 0.12, sz: length, color: "#777b78" },
      { x: side * 72.3, y: 0.012, z: z + length * 0.42, sx: 2.2, sy: 0.12, sz: length, color: "#747a79" },
    );
    // Tree wells at alternate blocks leave clear sight lines at crossings.
    if (block % 2 === 1) {
      CITY_PARKS.push({ x: side * 10.25, y: 0.085, z: z + 11, sx: 2.1, sy: 0.06, sz: 3.4, color: "#3d5945" });
      CITY_TREES.push({ x: side * 10.25, y: 1.7, z: z + 11, sx: 0.32, sy: 3.4, sz: 0.32, color: "#55463b" });
      CITY_TREES.push({ x: side * 10.25, y: 4.35, z: z + 11, sx: 1.6, sy: 2.1, sz: 1.6, color: "#47735a" });
    }
  }
}

// Street lamps and a few traffic signals are kept in large instance batches.
for (let block = 0; block < blockCenters.length; block++) {
  const z = blockCenters[block];
  for (const side of [-1, 1]) {
    const lampZ = z + 21;
    CITY_LAMPS.push(
      { x: side * 8.3, y: 3.2, z: lampZ, sx: 0.16, sy: 6.4, sz: 0.16, color: "#343d44" },
      { x: side * 7.75, y: 6.05, z: lampZ, sx: 1.15, sy: 0.14, sz: 0.17, color: "#343d44" },
      { x: side * 7.25, y: 5.9, z: lampZ, sx: 0.54, sy: 0.12, sz: 0.38, color: "#f6dfac" },
    );
    if (block % 2 === 0) {
      CITY_LAMPS.push({ x: side * 10.65, y: 3.2, z: z - 5, sx: 0.14, sy: 6.4, sz: 0.14, color: "#3a454a" });
    }
  }
}

// Pocket parks and layered tree crowns soften the street canyon.
for (let index = 0; index < 8; index++) {
  const z = 65 + index * 48;
  const side = index % 2 ? -1 : 1;
  CITY_PARKS.push({ x: side * 55.4, y: 0.025, z, sx: 3.4, sy: 0.07, sz: 18, color: "#405d48" });
  for (let tree = 0; tree < 3; tree++) {
    const tx = side * (52.6 + tree * 2.5);
    const tz = z - 5 + tree * 5;
    CITY_TREES.push({ x: tx, y: 2.2, z: tz, sx: 0.38, sy: 4.4, sz: 0.38, color: "#5b4839" });
    CITY_TREES.push({ x: tx, y: 5.25, z: tz, sx: 1.8, sy: 2.35, sz: 1.8, color: tree % 2 ? "#4a7658" : "#538263" });
  }
}

// Rolling, rounded green hills follow the western switchbacks; the eastern
// harbor gets a green promenade and subtropical palms.
for (let index = 0; index < 15; index++) {
  const row = Math.floor(index / 5);
  const side = index % 2 ? -1 : 1;
  CITY_HILLS.push({
    x: -126 - (index % 5) * 24,
    y: 19 + (index % 3) * 5,
    z: 270 + row * 60 + (index % 2) * 13,
    sx: 30 + (index % 3) * 10,
    sy: 20 + (index % 4) * 7,
    sz: 38 + (index % 2) * 12,
    color: side > 0 ? "#455f4e" : "#526b53",
  });
}
for (let index = 0; index < 10; index++) {
  const z = 126 + index * 9;
  const x = 139 + (index % 2) * 5;
  CITY_BEACH_FEATURES.push(
    { x, y: 2.65, z, sx: 0.34, sy: 5.3, sz: 0.34, color: "#6c553b" },
    { x, y: 5.75, z, sx: 1.9, sy: 0.85, sz: 1.5, color: "#4d805d" },
  );
}

// Bridge parapets and piers retain the existing elevated route.
CITY_BRIDGE_RAILS.push(
  { x: 159, y: 4.8, z: 357.2, sx: 82, sy: 1.5, sz: 0.3, color: "#59646b" },
  { x: 159, y: 4.8, z: 370.8, sx: 82, sy: 1.5, sz: 0.3, color: "#59646b" },
  { x: 124, y: 4.8, z: 405.2, sx: 28, sy: 1.5, sz: 0.3, color: "#59646b" },
  { x: 124, y: 4.8, z: 418.8, sx: 28, sy: 1.5, sz: 0.3, color: "#59646b" },
);
for (const x of [126, 144, 162, 180, 194]) {
  CITY_BRIDGE_PIERS.push({ x, y: 1.8, z: 364, sx: 1.8, sy: 4, sz: 1.8, color: "#8b8a81" });
}
for (const x of [112, 126, 138]) {
  CITY_BRIDGE_PIERS.push({ x, y: 1.8, z: 412, sx: 1.8, sy: 4, sz: 1.8, color: "#8b8a81" });
}

// Boulevard lane dashes and smaller route markings on each connected street.
for (const road of CITY_ROADS) {
  for (let segment = 0; segment < road.points.length - 1; segment++) {
    const a = road.points[segment];
    const b = road.points[segment + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const dashLength = road.id === "boulevard" ? 5.4 : 3.8;
    const spacing = road.id === "boulevard" ? 12 : 15;
    for (let distance = 7; distance < length - 3; distance += spacing) {
      const t = distance / length;
      CITY_MARKINGS.push({
        x: a.x + dx * t,
        y: a.y + (b.y - a.y) * t + 0.055,
        z: a.z + dz * t,
        sx: 0.15, sy: 0.018, sz: dashLength, ry: angle, color: "#e7e4d8",
      });
    }
  }
}


// Zebra crossings line up with the existing cross-street junctions.
for (const z of [76, 124, 172, 220, 268, 316, 364, 412, 460]) {
  for (let stripe = 0; stripe < 11; stripe++) {
    const x = -6.7 + stripe * 1.34;
    for (const offset of [-9.2, 9.2]) {
      CITY_MARKINGS.push({ x, y: 0.065, z: z + offset, sx: 0.92, sy: 0.022, sz: 2.15, color: "#e7e4d8" });
    }
  }
  for (const avenueX of [-62, 62]) {
    for (const side of [-1, 1]) {
      for (let stripe = 0; stripe < 8; stripe++) {
        const zOffset = -4.9 + stripe * 1.4;
        CITY_MARKINGS.push({ x: avenueX + side * 8.1, y: 0.065, z: z + zOffset, sx: 1.8, sy: 0.022, sz: 0.72, color: "#e7e4d8" });
      }
    }
  }
}

export const CITY_TREE_TRUNKS = CITY_TREES.filter((_, index) => index % 2 === 0);
const baseTreeCanopies = CITY_TREES.filter((_, index) => index % 2 === 1);
export const CITY_TREE_CANOPIES = baseTreeCanopies.flatMap((tree, index) => [
  { ...tree, sx: tree.sx * 0.76, sy: tree.sy * 0.82, sz: tree.sz * 0.76 },
  { ...tree, x: tree.x + tree.sx * 0.36, y: tree.y - tree.sy * 0.12, z: tree.z + tree.sz * 0.12, sx: tree.sx * 0.58, sy: tree.sy * 0.62, sz: tree.sz * 0.62, color: index % 2 ? "#5b8763" : "#3e6b52" },
  { ...tree, x: tree.x - tree.sx * 0.34, y: tree.y - tree.sy * 0.08, z: tree.z - tree.sz * 0.16, sx: tree.sx * 0.56, sy: tree.sy * 0.61, sz: tree.sz * 0.58, color: index % 3 ? "#4d7958" : "#628a61" },
]);
export const CITY_PALM_TRUNKS = CITY_BEACH_FEATURES.filter((_, index) => index % 2 === 0);
export const CITY_PALM_CROWNS = CITY_BEACH_FEATURES.filter((_, index) => index % 2 === 1);

export function isCityBuildingAt(x: number, z: number, margin = 1.25) {
  return CITY_BUILDINGS.some((building) =>
    Math.abs(x - building.x) < building.sx / 2 + margin &&
    Math.abs(z - building.z) < building.sz / 2 + margin,
  );
}

export function isCityGarageExitAt(x: number, z: number) {
  return z >= -1 && z <= CITY_START_Z + 2 && Math.abs(x) <= 3.5;
}

export function isCityJunctionAt(x: number, z: number) {
  for (const junction of CITY_JUNCTIONS) {
    const dx = x - junction.x;
    const dz = z - junction.z;
    const radius = junction.sx / 2;
    if (dx * dx + dz * dz <= radius * radius) return true;
  }
  return false;
}

const nearestRoad = { distance: Infinity, y: 0, grade: 0, width: 0, tangentX: 0, tangentZ: 1 };

/** Allocation-free nearest road/height sample for the free-drive simulation. */
export function sampleCityRoad(x: number, z: number) {
  let bestDistanceSq = Infinity;
  nearestRoad.distance = Infinity;
  nearestRoad.y = 0;
  nearestRoad.grade = 0;
  nearestRoad.width = 0;
  nearestRoad.tangentX = 0;
  nearestRoad.tangentZ = 1;
  for (const road of CITY_ROADS) {
    for (let index = 0; index < road.points.length - 1; index++) {
      const a = road.points[index];
      const b = road.points[index + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSq = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq));
      const rx = a.x + dx * t;
      const rz = a.z + dz * t;
      const offsetX = x - rx;
      const offsetZ = z - rz;
      const distanceSq = offsetX * offsetX + offsetZ * offsetZ;
      if (distanceSq >= bestDistanceSq) continue;
      bestDistanceSq = distanceSq;
      nearestRoad.distance = Math.sqrt(distanceSq);
      nearestRoad.y = a.y + (b.y - a.y) * t;
      const segmentLength = Math.sqrt(lengthSq);
      nearestRoad.grade = (b.y - a.y) / segmentLength;
      nearestRoad.width = road.width;
      nearestRoad.tangentX = dx / segmentLength;
      nearestRoad.tangentZ = dz / segmentLength;
    }
  }
  return nearestRoad;
}
