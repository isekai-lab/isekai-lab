import type { WalkSurface } from "../contracts/index.ts";
import { bridgeHeightAt, createWalkSurface, stairHeightAt, type HeightRegion } from "../maps/walk.ts";

const stair = { x: 2, z: 0, rotation: 0, width: 2, run: 4, rise: 2, steps: 4 } as const;
const bridge = { x: -2.5, z: 0, rotation: 0, length: 5, width: 1.5, deckHeight: .4, style: "stone" } as const;

/** Stable controller benchmark fixture, intentionally independent of the artwork maps. */
export function createWalkCourse(): WalkSurface {
  const regions: HeightRegion[] = [
    { id: "course:road", priority: 0, heightAt: (x, z) => Math.abs(x) <= 8 && Math.abs(z) <= 6 && !(x < 0 && Math.abs(z) < 1.1) ? 0 : undefined },
    { id: "course:platform", priority: 10, heightAt: (x, z) => x >= 1 && x <= 5 && z >= 1.8 && z <= 5 ? 2 : undefined },
    { id: "course:stairs", priority: 30, heightAt: (x, z) => stairHeightAt(stair, x, z) },
    { id: "course:bridge", priority: 40, heightAt: (x, z) => bridgeHeightAt(bridge, x, z) },
  ];
  return createWalkSurface("walk-course", regions, [
    { from: "course:road", to: "course:stairs" },
    { from: "course:stairs", to: "course:platform" },
    { from: "course:road", to: "course:bridge" },
  ], [{ id: "course:pillar", x: 0, z: 3, radius: .8 }], { x: 5.5, z: -3 });
}
