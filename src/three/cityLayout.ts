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
    id: "mountain-road",
    width: 11,
    points: [
      point(0, 188), point(0, 204), point(-2, 212), point(-8, 218), point(-17, 221),
      point(-25, 225), point(-31, 231, 1), point(-34, 247, 3),
      point(-46, 262, 6), point(-58, 278, 10), point(-70, 291, 14),
      point(-68, 309, 18), point(-82, 325, 23), point(-96, 342, 28),
      point(-113, 356, 33), point(-129, 375, 39), point(-145, 399, 46),
      point(-164, 418, 53), point(-181, 442, 60),
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
export const CITY_WINDOWS: CityInstance[] = [];
export const CITY_MARKINGS: CityInstance[] = [];
export const CITY_LAMPS: CityInstance[] = [];
export const CITY_TREES: CityInstance[] = [];
export const CITY_HILLS: CityInstance[] = [];
export const CITY_BRIDGE_PIERS: CityInstance[] = [];
export const CITY_BRIDGE_RAILS: CityInstance[] = [];
export const CITY_BEACH_FEATURES: CityInstance[] = [];

const palette = ["#596b7b", "#78828b", "#8b8f91", "#536573", "#a0a09a", "#68777c"];

for (let block = 0; block < 9; block++) {
  const z = 52 + block * 48;
  for (const side of [-1, 1]) {
    const width = 14 + ((block + (side > 0 ? 1 : 0)) % 3) * 3;
    const depth = 27 + (block % 2) * 7;
    const height = 19 + ((block * 7 + (side > 0 ? 4 : 0)) % 6) * 5;
    const centerX = side * (11.5 + width / 2);
    const centerZ = z + (side > 0 ? 8 : -7);
    CITY_BUILDINGS.push({
      x: centerX, y: height / 2, z: centerZ, sx: width, sy: height, sz: depth,
      color: palette[(block + (side > 0 ? 2 : 0)) % palette.length], side,
    });

    const floors = Math.max(3, Math.floor((height - 4) / 3.6));
    const panes = Math.max(3, Math.floor(depth / 4.2));
    for (let floor = 0; floor < floors; floor++) {
      for (let pane = 0; pane < panes; pane++) {
        CITY_WINDOWS.push({
          x: centerX - side * (width / 2 + 0.025),
          y: 2.5 + floor * 3.6,
          z: centerZ - depth / 2 + 2.6 + pane * 4.2,
          sx: 2.35, sy: 1.65, sz: 0.08,
          ry: side < 0 ? Math.PI / 2 : -Math.PI / 2,
          color: (floor + pane + block) % 5 === 0 ? "#9dc8df" : "#405768",
        });
      }
    }
  }

  const lampZ = 34 + block * 48;
  for (const side of [-1, 1]) {
    CITY_LAMPS.push({ x: side * 8.3, y: 3.2, z: lampZ, sx: 0.16, sy: 6.4, sz: 0.16, color: "#343d44" });
    CITY_LAMPS.push({ x: side * 7.75, y: 6.05, z: lampZ, sx: 1.15, sy: 0.14, sz: 0.17, color: "#343d44" });
    CITY_LAMPS.push({ x: side * 7.25, y: 5.9, z: lampZ, sx: 0.54, sy: 0.12, sz: 0.38, color: "#f6dfac" });
    CITY_TREES.push({ x: side * 10.25, y: 1.65, z: lampZ + 12, sx: 0.32, sy: 3.3, sz: 0.32, color: "#594a3b" });
    CITY_TREES.push({ x: side * 10.25, y: 4.25, z: lampZ + 12, sx: 1.65, sy: 2.1, sz: 1.65, color: "#47735c" });
  }
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

for (const x of [-1, 1]) {
  for (let index = 0; index < 10; index++) {
    const z = 38 + index * 43;
    CITY_TREES.push({ x: x * 10.25, y: 1.65, z, sx: 0.32, sy: 3.3, sz: 0.32, color: "#594a3b" });
    CITY_TREES.push({ x: x * 10.25, y: 4.25, z, sx: 1.65, sy: 2.1, sz: 1.65, color: "#47735c" });
  }
}

// Rolling foothills along the switchback route. Large low-poly forms keep the silhouette cheap.
for (let index = 0; index < 11; index++) {
  const side = index % 2 ? -1 : 1;
  CITY_HILLS.push({
    x: -116 + (index % 4) * 30,
    y: 12 + (index % 3) * 6,
    z: 320 + Math.floor(index / 4) * 48 + (index % 2) * 18,
    sx: 38 + (index % 3) * 13,
    sy: 26 + (index % 4) * 9,
    sz: 44 + (index % 2) * 16,
    color: side > 0 ? "#576d59" : "#71806a",
  });
}

// Bridge parapets and piers at repeated intervals across the water.
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

// Beach palms and warm promenade markers beyond the eastern city blocks.
for (let index = 0; index < 8; index++) {
  const z = 128 + index * 10;
  CITY_BEACH_FEATURES.push({ x: 139 + (index % 2) * 5, y: 2.6, z, sx: 0.34, sy: 5.2, sz: 0.34, color: "#6c553b" });
  CITY_BEACH_FEATURES.push({ x: 139 + (index % 2) * 5, y: 5.65, z, sx: 2.0, sy: 0.9, sz: 1.3, color: "#4d805d" });
}

export const CITY_TREE_TRUNKS = CITY_TREES.filter((_, index) => index % 2 === 0);
export const CITY_TREE_CANOPIES = CITY_TREES.filter((_, index) => index % 2 === 1);
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
