export type MapId = "town" | "forest";

export type Vec2 = Readonly<{ x: number; z: number }>;
export type Waterway = Readonly<{ axis: "x" | "z"; center: number; width: number; length: number }>;
export type TerrainLevel = Readonly<{ x: number; z: number; width: number; depth: number; height: number; material: "stone" | "grass" }>;
export type PathStrip = Readonly<{ points: readonly Vec2[]; width: number; material: "cobble" | "dirt" }>;
export type StairSpec = Readonly<{ x: number; z: number; rotation: number; width: number; run: number; rise: number; steps: number }>;
export type BridgeSpec = Readonly<{ x: number; z: number; rotation: number; length: number; width: number; deckHeight: number; style: "stone" | "wood" }>;

export type ItemKind = "house" | "tree" | "rock" | "lantern" | "ruin" | "market" | "barrels" | "stump" | "shrub" | "flowers";
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
  cameraTarget: Readonly<{ x: number; y: number; z: number }>;
}>;

export type ViewerSettings = { mapId: MapId; zoom: number; yaw: number; dusk: boolean; lightweight: boolean; shadows: boolean; effects: boolean; paused: boolean };

export const defaultSettings: ViewerSettings = { mapId: "town", zoom: 1, yaw: 0, dusk: false, lightweight: false, shadows: true, effects: true, paused: false };

export function validSettings(input: unknown): input is ViewerSettings {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (value.mapId === "town" || value.mapId === "forest") &&
    typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom >= 0.7 && value.zoom <= 1.65 &&
    typeof value.yaw === "number" && Number.isFinite(value.yaw) && Math.abs(value.yaw) <= 0.35 &&
    ["dusk", "lightweight", "shadows", "effects", "paused"].every((key) => typeof value[key] === "boolean");
}
