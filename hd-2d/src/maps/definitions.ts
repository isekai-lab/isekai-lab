import type { MapDefinition, Placement } from "../contracts/index.ts";

const place = (
  kind: Placement["kind"], x: number, z: number, height = 0, scale = 1,
  rotation = 0, variant = 0,
): Placement => ({ kind, x, z, height, scale, rotation, variant });

export const maps: Record<MapDefinition["id"], MapDefinition> = {
  town: {
    id: "town",
    name: "石畳の水辺街",
    seed: 7319,
    size: 16,
    waterway: { axis: "z", center: -3.8, width: 2.8, length: 31 },
    levels: [
      { x: -6.6, z: 5.9, width: 8.2, depth: 6.2, height: 1.05, material: "stone" },
      { x: 6.4, z: 5.9, width: 7.8, depth: 6.2, height: 1.05, material: "stone" },
      { x: -6.9, z: -6.3, width: 7.3, depth: 5.5, height: 0.45, material: "stone" },
    ],
    paths: [
      { points: [{ x: -12, z: -1.1 }, { x: -6, z: -1.1 }, { x: -3.8, z: -1.1 }, { x: 1, z: -1 }, { x: 10, z: -1 }], width: 2.75, material: "cobble" },
      { points: [{ x: -7, z: 2.2 }, { x: -4, z: 2.7 }, { x: -3.1, z: 4.1 }], width: 1.8, material: "cobble" },
      { points: [{ x: 7, z: 2.1 }, { x: 4, z: 2.7 }, { x: 3.2, z: 4.1 }], width: 1.8, material: "cobble" },
    ],
    stairs: [
      { x: -3.1, z: 3.8, rotation: 0, width: 1.45, run: 2.5, rise: 1.05, steps: 6 },
      { x: 3.15, z: 3.8, rotation: 0, width: 1.45, run: 2.5, rise: 1.05, steps: 6 },
      { x: -7.1, z: -3.55, rotation: 0, width: 1.3, run: 1.7, rise: 0.45, steps: 4 },
    ],
    bridges: [
      { x: -3.8, z: -1.1, rotation: 0, length: 4.2, width: 2.25, deckHeight: 0.42, style: "stone" },
      { x: -3.8, z: 6.4, rotation: 0, length: 4.1, width: 1.75, deckHeight: 1.36, style: "wood" },
    ],
    placements: [
      place("house", -8.2, 4.7, 1.05, 1.18, Math.PI / 2, 0),
      place("house", -2.1, 5.7, 1.05, 1.04, Math.PI / 2, 2),
      place("house", 5.8, 5.1, 1.05, 1.25, -Math.PI / 2, 1),
      place("house", 8.6, -5.5, 0, 0.82, Math.PI - .1, 2),
      place("house", -9.8, -6.5, .45, .72, .12, 1),
      place("market", -4.7, -0.3, 0, 0.85, 0.12),
      place("market", 4.7, 0.2, 0, 0.78, -0.15, 1),
      place("lantern", -5.4, -1.9),
      place("lantern", -1.7, -1.9),
      place("lantern", -3.4, 5.3, 1.05),
      place("lantern", 3.5, 5.3, 1.05),
      place("barrels", -6.8, -2.6, 0, 0.85, 0.2),
      place("barrels", 3.8, -4.3, 0, 0.75, -0.3),
      place("barrels", 7.2, 2.1, 0, 0.65),
      place("tree", -9.2, -7.5, 0, 0.75, 0, 1),
      place("tree", 9.4, 3.1, 0, 0.72, 0, 0),
      place("shrub", -8.9, 2.3, 0, 0.8),
      place("flowers", -5.1, 3.1, 1.05, 1),
      place("flowers", 5.4, 3.1, 1.05, 0.9, 0, 1),
    ],
    spawnHint: { x: 1.2, z: -1.1 },
    cameraTarget: { x: -1.2, y: 1.25, z: .4 },
    environment: { cameraBeta: 1.1, cameraYaw: -1.2, orthoHalfHeight: 8.4, portraitHalfWidth: 7.7, sunColor: "#fff0cc", skyColor: "#b7d0d0", fogColor: "#8aa1a8" },
  },
  forest: {
    id: "forest",
    name: "薄明の森",
    seed: 1847,
    size: 19,
    waterway: { axis: "z", center: 1.4, width: 2.5, length: 38 },
    levels: [
      { x: -7, z: 5.6, width: 7.5, depth: 6.3, height: 0.5, material: "grass" },
      { x: 7.8, z: -5.8, width: 5.3, depth: 5.5, height: 0.35, material: "grass" },
    ],
    paths: [
      { points: [{ x: -7.5, z: -8.5 }, { x: -5, z: -5.4 }, { x: -5.7, z: -2 }, { x: -2.7, z: 0.5 }, { x: -0.25, z: 0.6 }], width: 1.75, material: "dirt" },
      { points: [{ x: 3.05, z: 0.6 }, { x: 5, z: 2.4 }, { x: 7.8, z: 2.1 }, { x: 9.4, z: 4.7 }], width: 1.45, material: "dirt" },
      { points: [{ x: -2.9, z: 0.8 }, { x: -4.2, z: 3.5 }, { x: -3.4, z: 5.8 }, { x: -1.5, z: 8.3 }], width: 1.55, material: "dirt" },
    ],
    stairs: [],
    bridges: [
      { x: 1.4, z: 0.6, rotation: 0, length: 3.3, width: 1.45, deckHeight: 0.32, style: "wood" },
    ],
    placements: [
      place("ruin", -5.7, 2.4, 0.5, 1.05, -0.18),
      place("ruin", 6.2, 5.8, 0, 0.68, Math.PI / 2, 1),
      place("stump", -0.8, -3.2, 0, 0.85),
      place("tree", -9.3, -7.5, 0, 1.25, 0.2, 0),
      place("tree", -5.2, -8.6, 0, 0.9, -0.1, 1),
      place("tree", 0.1, -9.2, 0, 1.18, 0, 2),
      place("tree", 6, -8, 0, 1.05, 0.3, 1),
      place("tree", 9.1, -4.8, 0.35, 1.28, 0, 2),
      place("tree", 9.6, 1.8, 0, 0.95, 0, 0),
      place("tree", 8.4, 7.7, 0, 1.25, 0, 1),
      place("tree", 2.5, 9.1, 0, 1.08, 0, 2),
      place("tree", -3.4, 9.4, 0.5, 1.3, 0, 0),
      place("tree", -9.5, 7.1, 0.5, 1.15, 0, 2),
      place("tree", -10.2, 1.2, 0, 0.92, 0, 1),
      place("tree", -8.6, 4.8, .5, 1.2, .2, 2),
      place("tree", 6.8, 8.5, 0, 1.12, -.15, 0),
      place("rock", -2, 5.3, 0, 0.9),
      place("rock", 5.4, 3.9, 0, 0.72, 0.4),
      place("rock", 4.1, -2.8, 0, 0.82, -0.2),
      place("rock", -6.5, -4.1, 0, 0.55),
      place("shrub", -7.5, -1, 0, 1.15),
      place("shrub", 5.8, -0.4, 0, 0.9),
      place("shrub", 3.7, 6.8, 0, 1.1),
      place("flowers", -3.7, -5.1, 0, 1.1),
      place("flowers", 4.2, 1.2, 0, 0.8, 0, 1),
      place("log", -7.6, .5, 0, .85, .45),
      place("log", 6.8, 6.1, 0, .7, -.2),
    ],
    spawnHint: { x: -4.7, z: -1.1 },
    cameraTarget: { x: -.8, y: 1, z: .4 },
    environment: { palette: "forest", cameraBeta: 1.08, cameraYaw: -1.16, orthoHalfHeight: 9, portraitHalfWidth: 7.5, fogDensity: .014, sunColor: "#e9f0bd", skyColor: "#93b9a0", fogColor: "#728d83" },
  },
  cave: {
    id: "cave", name: "灯火の晶洞", seed: 3901, size: 14,
    waterway: { axis: "x", center: -3.4, width: 2.5, length: 28 },
    levels: [{ x: 4.5, z: 4.8, width: 6, depth: 4.7, height: 1, material: "stone" }],
    paths: [{ points: [{ x: -11, z: -6.5 }, { x: -6, z: -4.3 }, { x: -3.4, z: -3.4 }, { x: 0, z: -.6 }, { x: 3.4, z: 2.5 }, { x: 7, z: 5.4 }], width: 1.65, material: "dirt" }],
    stairs: [{ x: 1.8, z: 1.1, rotation: .78, width: 1.5, run: 2.8, rise: 1, steps: 5 }],
    bridges: [{ x: -3.4, z: -3.4, rotation: Math.PI / 2, length: 3.6, width: 1.45, deckHeight: .38, style: "wood" }],
    placements: [
      place("caveWall", -10, 6, 0, 1.55, .2), place("caveWall", -8, -7.5, 0, 1.45, -.3), place("caveWall", 8.6, -6.8, 0, 1.5, .1), place("caveWall", 10, 5.5, 0, 1.55, -.2),
      place("caveWall", -1, 8.2, 0, 1.3), place("stalagmite", -6.2, 1.6, 0, 1.15), place("stalagmite", 5.5, -2.8, 0, 1.1),
      place("crystal", -1.2, -4.6, 0, 1.15), place("crystal", 5.8, 3.6, 1, .95), place("lantern", .2, -.4), place("lantern", 4.8, 4.5, 1), place("ruin", 6.7, 5.2, 1, .9), place("rock", -8, 3.5, 0, 1.2),
    ],
    spawnHint: { x: -.7, z: -.8 },
    cameraTarget: { x: -.4, y: 1.1, z: .1 }, environment: { palette: "cave", fogDensity: .024, cameraBeta: 1.1, cameraYaw: -1.18, orthoHalfHeight: 8.5, portraitHalfWidth: 7.2, sunColor: "#c07c62", skyColor: "#59647b", fogColor: "#303b52" },
  },
};

export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
}

export function bridgeSpansWaterway(map: MapDefinition, bridgeIndex = 0): boolean {
  const bridge = map.bridges[bridgeIndex];
  if (!bridge) return false;
  const crossesX = Math.abs(Math.cos(bridge.rotation)) >= Math.SQRT1_2;
  const crossesWater = map.waterway.axis === "z" ? crossesX : !crossesX;
  const center = map.waterway.axis === "z" ? bridge.x : bridge.z;
  return crossesWater && Math.abs(center - map.waterway.center) < 0.01 && bridge.length > map.waterway.width;
}

export function mapHasRequiredStructure(map: MapDefinition): boolean {
  const inside = map.placements.every((item) => Math.abs(item.x) <= map.size && Math.abs(item.z) <= map.size);
  if (!inside || !bridgeSpansWaterway(map)) return false;
  if (map.id === "town") {
    return map.placements.filter((item) => item.kind === "house").length >= 4 &&
      map.placements.some((item) => item.kind === "lantern") &&
      map.levels.some((level) => level.height > 0) &&
      map.stairs.some((stair) => stair.rise > 0 && stair.steps >= 3);
  }
  if (map.id === "forest") {
    return map.paths.some((path) => path.points.length >= 4) &&
      map.placements.filter((item) => item.kind === "tree").length >= 8 &&
      map.placements.some((item) => item.kind === "ruin");
  }
  return map.paths.some((path) => path.points.length >= 5) &&
    map.stairs.some((stair) => stair.rise > 0) &&
    map.placements.some((item) => item.kind === "caveWall") &&
    map.placements.some((item) => item.kind === "crystal");
}
