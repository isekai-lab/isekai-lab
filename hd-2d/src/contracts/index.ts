export type MapId = "town" | "forest" | "cave";

export type Vec2 = Readonly<{ x: number; z: number }>;
export type Vec3Data = Readonly<{ x: number; y: number; z: number }>;
export type Waterway = Readonly<{ axis: "x" | "z"; center: number; width: number; length: number }>;
export type TerrainLevel = Readonly<{ x: number; z: number; width: number; depth: number; height: number; material: "stone" | "grass" }>;
export type PathStrip = Readonly<{ points: readonly Vec2[]; width: number; material: "cobble" | "dirt" }>;
export type StairSpec = Readonly<{ x: number; z: number; rotation: number; width: number; run: number; rise: number; steps: number }>;
export type BridgeSpec = Readonly<{ x: number; z: number; rotation: number; length: number; width: number; deckHeight: number; style: "stone" | "wood" }>;

export type ItemKind = "house" | "tree" | "rock" | "lantern" | "ruin" | "market" | "barrels" | "stump" | "shrub" | "flowers" | "crystal" | "caveWall" | "caveArch" | "stalagmite" | "log";
export type Placement = Readonly<{ kind: ItemKind; x: number; z: number; height?: number; scale?: number; rotation?: number; variant?: number }>;

export type MapDefinition = Readonly<{
  id: MapId;
  name: string;
  seed: number;
  size: number;
  waterway: Waterway;
  levels: readonly TerrainLevel[];
  paths: readonly PathStrip[];
  stairs: readonly StairSpec[];
  bridges: readonly BridgeSpec[];
  placements: readonly Placement[];
  /** A deliberate, readable starting point on the primary walking band. */
  spawnHint?: Vec2;
  cameraTarget: Vec3Data;
  /** Deliberately data-only extension seam for map-specific stage-2 lighting/camera work. */
  environment?: Readonly<{
    cameraBeta?: number;
    cameraYaw?: number;
    orthoHalfHeight?: number;
    /** Landscape stays composed by height; portrait uses this independent crop width. */
    portraitHalfWidth?: number;
    fogDensity?: number;
    palette?: "day" | "forest" | "cave";
    sunColor?: string;
    sunIntensity?: number;
    skyColor?: string;
    skyIntensity?: number;
    groundColor?: string;
    ambientColor?: string;
    fogColor?: string;
  }>;
}>;

export type WalkObstacle = Readonly<{ id: string; x: number; z: number; radius: number }>;
export type WalkSample = Readonly<{ surfaceId: string; height: number }>;

/** Gameplay-facing ground contract. Rendering must never be used for collision. */
export type WalkSurface = Readonly<{
  id: string;
  sample: (x: number, z: number, currentSurfaceId?: string) => WalkSample | undefined;
  heightAt: (x: number, z: number, currentSurfaceId?: string) => number | undefined;
  surfaceIds: readonly string[];
  connections: readonly Readonly<{ from: string; to: string }>[];
  obstacles: readonly WalkObstacle[];
  spawn: Vec3Data & Readonly<{ surfaceId: string }>;
}>;

export type BenchmarkMetadata = Readonly<{
  mapId: MapId;
  preset: string;
  presetVersion: number;
  schemaVersion: number;
  buildId: string;
}>;

export type ViewerSettings = { mapId: MapId; zoom: number; yaw: number; dusk: boolean; lightweight: boolean; shadows: boolean; effects: boolean; paused: boolean };

export const defaultSettings: ViewerSettings = { mapId: "town", zoom: 1, yaw: 0, dusk: false, lightweight: false, shadows: true, effects: true, paused: false };

export function validSettings(input: unknown): input is ViewerSettings {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (value.mapId === "town" || value.mapId === "forest" || value.mapId === "cave") &&
    typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom >= 0.7 && value.zoom <= 1.65 &&
    typeof value.yaw === "number" && Number.isFinite(value.yaw) && Math.abs(value.yaw) <= 0.35 &&
    ["dusk", "lightweight", "shadows", "effects", "paused"].every((key) => typeof value[key] === "boolean");
}
