import type {
  MapDefinition,
  WalkObstacle,
  WalkSample,
  WalkSurface,
} from "../contracts/index.ts";

export type HeightRegion = Readonly<{
  id: string;
  priority: number;
  heightAt: (x: number, z: number) => number | undefined;
}>;

const rotated = (x: number, z: number, cx: number, cz: number, rotation: number) => ({
  x: (x - cx) * Math.cos(rotation) - (z - cz) * Math.sin(rotation),
  z: (x - cx) * Math.sin(rotation) + (z - cz) * Math.cos(rotation),
});

export function stairHeightAt(
  stair: MapDefinition["stairs"][number],
  x: number,
  z: number,
): number | undefined {
  const local = rotated(x, z, stair.x, stair.z, stair.rotation);
  if (Math.abs(local.x) > stair.width / 2 || Math.abs(local.z) > stair.run / 2) return undefined;
  const step = Math.min(stair.steps - 1, Math.max(0, Math.floor(((local.z + stair.run / 2) / stair.run) * stair.steps)));
  return stair.rise * ((step + 1) / stair.steps);
}

export function bridgeHeightAt(
  bridge: MapDefinition["bridges"][number],
  x: number,
  z: number,
): number | undefined {
  const local = rotated(x, z, bridge.x, bridge.z, bridge.rotation);
  if (Math.abs(local.x) > bridge.length / 2 || Math.abs(local.z) > bridge.width / 2) return undefined;
  if (bridge.style === "wood") return bridge.deckHeight;
  const segments = 9;
  const segment = Math.min(segments - 1, Math.max(0, Math.floor(((local.x + bridge.length / 2) / bridge.length) * segments)));
  return bridge.deckHeight + Math.sin((segment / (segments - 1)) * Math.PI) * .24;
}

function isWater(definition: MapDefinition, x: number, z: number): boolean {
  const water = definition.waterway;
  const cross = water.axis === "z" ? x : z;
  const along = water.axis === "z" ? z : x;
  return Math.abs(cross - water.center) <= water.width / 2 && Math.abs(along) <= water.length / 2;
}

export function createWalkSurface(
  id: string,
  regions: readonly HeightRegion[],
  connections: readonly Readonly<{ from: string; to: string }>[],
  obstacles: readonly WalkObstacle[],
  spawnHint: Readonly<{ x: number; z: number }>,
): WalkSurface {
  const byId = new Map(regions.map((region) => [region.id, region]));
  const linked = (a: string, b: string) => a === b || connections.some((edge) =>
    (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a));
  const sample = (x: number, z: number, currentSurfaceId?: string): WalkSample | undefined => {
    const candidates = regions
      .map((region) => ({ region, height: region.heightAt(x, z) }))
      .filter((candidate): candidate is { region: HeightRegion; height: number } => candidate.height !== undefined)
      .filter((candidate) => !currentSurfaceId || !byId.has(currentSurfaceId) || linked(currentSurfaceId, candidate.region.id))
      .sort((a, b) => b.region.priority - a.region.priority);
    const selected = candidates[0];
    return selected ? { surfaceId: selected.region.id, height: selected.height } : undefined;
  };
  const initial = sample(spawnHint.x, spawnHint.z);
  if (!initial) throw new Error(`Invalid spawn for ${id}`);
  return {
    id,
    sample,
    heightAt: (x, z, current) => sample(x, z, current)?.height,
    surfaceIds: regions.map((region) => region.id),
    connections,
    obstacles,
    spawn: { x: spawnHint.x, y: initial.height, z: spawnHint.z, surfaceId: initial.surfaceId },
  };
}

export function createMapWalkSurface(definition: MapDefinition): WalkSurface {
  const baseId = `${definition.id}:base`;
  const regions: HeightRegion[] = [{
    id: baseId,
    priority: 0,
    heightAt: (x, z) => Math.abs(x) <= definition.size && Math.abs(z) <= definition.size && !isWater(definition, x, z) ? 0 : undefined,
  }];
  const connections: { from: string; to: string }[] = [];
  definition.levels.forEach((level, index) => {
    const levelId = `${definition.id}:level:${index}`;
    regions.push({ id: levelId, priority: 10, heightAt: (x, z) =>
      Math.abs(x - level.x) <= level.width / 2 && Math.abs(z - level.z) <= level.depth / 2 ? level.height : undefined });
    connections.push({ from: baseId, to: levelId });
  });
  definition.stairs.forEach((stair, index) => {
    const stairId = `${definition.id}:stairs:${index}`;
    regions.push({ id: stairId, priority: 30, heightAt: (x, z) => stairHeightAt(stair, x, z) });
    connections.push({ from: baseId, to: stairId });
    definition.levels.forEach((_, levelIndex) => connections.push({ from: stairId, to: `${definition.id}:level:${levelIndex}` }));
  });
  definition.bridges.forEach((bridge, index) => {
    const bridgeId = `${definition.id}:bridge:${index}`;
    regions.push({ id: bridgeId, priority: 40, heightAt: (x, z) => bridgeHeightAt(bridge, x, z) });
    connections.push({ from: baseId, to: bridgeId });
    definition.levels.forEach((_, levelIndex) => connections.push({ from: bridgeId, to: `${definition.id}:level:${levelIndex}` }));
  });
  const obstacles = definition.placements
    .filter((item) => ["house", "tree", "ruin", "rock", "caveWall", "stalagmite"].includes(item.kind))
    .map((item, index) => ({
      id: `${definition.id}:obstacle:${index}`,
      x: item.x,
      z: item.z,
      radius: (item.scale ?? 1) * (item.kind === "house" ? 1.45 : item.kind === "caveWall" ? 1.7 : .7),
    }));
  const candidates = [-.35, -.6, .35, .6, 0].flatMap((x) => [-.35, -.6, .35, .6, 0].map((z) => ({ x: x * definition.size, z: z * definition.size })));
  const hinted = definition.spawnHint;
  const isValid = (point: Readonly<{ x: number; z: number }>) => !isWater(definition, point.x, point.z) && !obstacles.some((obstacle) => Math.hypot(point.x - obstacle.x, point.z - obstacle.z) <= obstacle.radius + .3);
  const spawnHint = hinted && isValid(hinted) ? hinted : candidates.find(isValid);
  if (!spawnHint) throw new Error(`No valid spawn for ${definition.id}`);
  return createWalkSurface(definition.id, regions, connections, obstacles, spawnHint);
}
