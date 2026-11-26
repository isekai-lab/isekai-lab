import {
  Color3,
  InstancedMesh,
  Mesh,
  MeshBuilder,
  PointLight,
  TransformNode,
  Vector3,
  VertexData,
} from "@babylonjs/core";
import type { Material, Node, Scene, StandardMaterial } from "@babylonjs/core";
import type { AbstractMesh } from "@babylonjs/core";
import type { BridgeSpec, MapDefinition, Placement, StairSpec, WalkSurface } from "../contracts/index.ts";
import { seeded, solidTerrainHeightAt } from "./definitions.ts";
import { createWorldMaterials, type WorldMaterials } from "./materials.ts";
import { bridgeHeightAt, createMapWalkSurface, stairHeightAt } from "./walk.ts";

export type WorldHandle = {
  root: TransformNode;
  bounds: number;
  target: Vector3;
  shadowCasters: readonly AbstractMesh[];
  walk: WalkSurface;
  update: (elapsedSeconds: number) => void;
  dispose: () => void;
};

type PrimitiveKind = "box" | "cylinder" | "sphere" | "cone" | "rock" | "plane";

class PrimitivePool {
  readonly casters: AbstractMesh[] = [];
  private readonly sources = new Map<string, Mesh>();
  private serial = 0;
  private readonly scene: Scene;
  private readonly root: TransformNode;

  constructor(scene: Scene, root: TransformNode) {
    this.scene = scene;
    this.root = root;
  }

  private source(kind: PrimitiveKind, material: StandardMaterial): Mesh {
    const key = `${kind}:${material.name}`;
    const cached = this.sources.get(key);
    if (cached) return cached;
    let mesh: Mesh;
    if (kind === "box") {
      mesh = MeshBuilder.CreateBox(`source-${key}`, { size: 1 }, this.scene);
    } else if (kind === "cylinder") {
      mesh = MeshBuilder.CreateCylinder(`source-${key}`, { diameter: 1, height: 1, tessellation: 8 }, this.scene);
    } else if (kind === "cone") {
      mesh = MeshBuilder.CreateCylinder(`source-${key}`, { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 7 }, this.scene);
    } else if (kind === "rock") {
      mesh = MeshBuilder.CreatePolyhedron(`source-${key}`, { type: 1, size: 0.5 }, this.scene);
    } else if (kind === "plane") {
      mesh = MeshBuilder.CreatePlane(`source-${key}`, { size: 1 }, this.scene);
    } else {
      mesh = MeshBuilder.CreateSphere(`source-${key}`, { diameter: 1, segments: 6 }, this.scene);
    }
    mesh.parent = this.root;
    mesh.position.y = -1000;
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    this.sources.set(key, mesh);
    return mesh;
  }

  add(
    kind: PrimitiveKind,
    name: string,
    parent: Node,
    position: Vector3,
    scale: Vector3,
    material: StandardMaterial,
    rotation = Vector3.Zero(),
    castsShadow = true,
  ): InstancedMesh {
    const instance = this.source(kind, material).createInstance(`${name}-${this.serial++}`);
    instance.parent = parent;
    instance.position.copyFrom(position);
    instance.scaling.copyFrom(scale);
    instance.rotation.copyFrom(rotation);
    instance.isPickable = false;
    if (castsShadow) this.casters.push(instance);
    return instance;
  }

  box(
    name: string,
    parent: Node,
    position: Vector3,
    scale: Vector3,
    material: StandardMaterial,
    rotation = Vector3.Zero(),
    castsShadow = true,
  ): InstancedMesh {
    return this.add("box", name, parent, position, scale, material, rotation, castsShadow);
  }
}

function addGround(
  scene: Scene,
  root: TransformNode,
  name: string,
  width: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: Material,
  rotation = 0,
): Mesh {
  const ground = MeshBuilder.CreateGround(name, { width, height: depth }, scene);
  ground.parent = root;
  ground.position.set(x, y, z);
  ground.rotation.y = rotation;
  ground.material = material;
  ground.receiveShadows = true;
  ground.isPickable = false;
  return ground;
}

export function joinedPathIndices(pointCount: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < pointCount - 1; index += 1) {
    indices.push(index * 2 + 2, index * 2 + 1, index * 2);
    indices.push(index * 2 + 2, index * 2 + 3, index * 2 + 1);
  }
  return indices;
}

export function pathSurfaceHeightAt(definition: MapDefinition, x: number, z: number): number | undefined {
  for (const bridge of definition.bridges) {
    const height = bridgeHeightAt(bridge, x, z);
    if (height !== undefined) return height;
  }
  for (const stair of definition.stairs) {
    const height = stairHeightAt(stair, x, z);
    if (height !== undefined) return height;
  }
  return solidTerrainHeightAt(definition, x, z);
}

function densePath(points: MapDefinition["paths"][number]["points"]): { x: number; z: number }[] {
  const result: { x: number; z: number }[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const segments = Math.max(1, Math.ceil(distance / .28));
    for (let step = 0; step < segments; step += 1) {
      const amount = step / segments;
      result.push({ x: from.x + (to.x - from.x) * amount, z: from.z + (to.z - from.z) * amount });
    }
  }
  result.push({ ...points[points.length - 1] });
  return result;
}

function addPath(
  scene: Scene,
  root: TransformNode,
  definition: MapDefinition,
  materials: WorldMaterials,
): void {
  for (const path of definition.paths) {
    const points = densePath(path.points);
    const left: number[] = [];
    const right: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
      const offsetX = (next.z - previous.z) / length * path.width / 2;
      const offsetZ = -(next.x - previous.x) / length * path.width / 2;
      const leftX = points[index].x + offsetX;
      const leftZ = points[index].z + offsetZ;
      const rightX = points[index].x - offsetX;
      const rightZ = points[index].z - offsetZ;
      const centerHeight = pathSurfaceHeightAt(definition, points[index].x, points[index].z) ?? 0;
      left.push(leftX, (pathSurfaceHeightAt(definition, leftX, leftZ) ?? centerHeight) + .055, leftZ);
      right.push(rightX, (pathSurfaceHeightAt(definition, rightX, rightZ) ?? centerHeight) + .055, rightZ);
    }
    const positions = left.flatMap((value, index) => index % 3 === 0 ? [value, left[index + 1], left[index + 2], right[index], right[index + 1], right[index + 2]] : []);
    const indices = joinedPathIndices(points.length);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = Array.from({ length: positions.length }, (_, index) => index % 3 === 1 ? 1 : 0);
    data.uvs = Array.from({ length: points.length }, (_, index) => [0, index * .18, 1, index * .18]).flat();
    const mesh = new Mesh(`${path.material}-joined-path`, scene);
    data.applyToMesh(mesh);
    mesh.parent = root;
    mesh.material = definition.id === "cave" ? materials.caveSoil : materials[path.material];
    mesh.receiveShadows = true;
    mesh.isPickable = false;
  }
}

function addTerrain(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  definition: MapDefinition,
  materials: WorldMaterials,
): StandardMaterial {
  const baseMaterial = definition.id === "town" ? materials.groundCobble : definition.id === "cave" ? materials.caveRock : materials.grass;
  addGround(scene, root, "ground", definition.size * 2, definition.size * 2, 0, 0, 0, baseMaterial);
  for (const level of definition.levels) {
    pool.box(
      "raised-ground",
      root,
      new Vector3(level.x, level.height / 2, level.z),
      new Vector3(level.width, level.height, level.depth),
      definition.id === "cave" ? materials.caveRock : level.material === "stone" ? materials.masonry : materials.grass,
      Vector3.Zero(),
      false,
    );
  }
  const water = definition.waterway;
  const width = water.axis === "z" ? water.width : water.length;
  const depth = water.axis === "z" ? water.length : water.width;
  const x = water.axis === "z" ? water.center : 0;
  const z = water.axis === "x" ? water.center : 0;
  addGround(scene, root, "waterway", width, depth, x, 0.065, z, materials.water);
  if (definition.id !== "town") {
    const bankLength = water.axis === "z" ? water.length : water.width;
    const bankWidth = .38;
    for (const side of [-1, 1]) {
      const bx = water.axis === "z" ? water.center + side * (water.width / 2 + bankWidth / 2) : 0;
      const bz = water.axis === "x" ? water.center + side * (water.width / 2 + bankWidth / 2) : 0;
      addGround(scene, root, "water-bank", water.axis === "z" ? bankWidth : bankLength, water.axis === "z" ? bankLength : bankWidth, bx, .075, bz, definition.id === "cave" ? materials.caveSoil : materials.moss);
      for (let along = -water.length / 2 + 1.2; along < water.length / 2; along += 3.2) {
        const jitter = Math.sin(along * 2.3 + side) * .22;
        const px = water.axis === "z" ? bx + side * .18 : along + jitter;
        const pz = water.axis === "z" ? along + jitter : bz + side * .18;
        pool.add("rock", "shore-stone", root, new Vector3(px, .12, pz), new Vector3(.52, .25, .4), definition.id === "cave" ? materials.caveRock : materials.moss, new Vector3(0, along, 0), false);
      }
    }
  } else {
    // A narrow masonry coping keeps the waterfront legible without changing walk surfaces.
    for (const side of [-1, 1]) {
      const x = water.center + side * (water.width / 2 + .18);
      addGround(scene, root, "town-river-coping", .32, water.length, x, .12, 0, materials.masonry);
      for (let z = -water.length / 2 + 1; z < water.length / 2; z += 2.4) {
        pool.add("rock", "coping-cap", root, new Vector3(x, .23, z + Math.sin(z * 1.7) * .08), new Vector3(.32, .16, .46), materials.masonry, new Vector3(0, z * .23, 0), false);
      }
    }
  }
  addPath(scene, root, definition, materials);
  return materials.water;
}

function addStairs(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  stair: StairSpec,
  material: StandardMaterial,
): void {
  const group = new TransformNode("stairs", scene);
  group.parent = root;
  group.position.set(stair.x, 0, stair.z);
  group.rotation.y = stair.rotation;
  const tread = stair.run / stair.steps;
  for (let index = 0; index < stair.steps; index += 1) {
    const height = stair.rise * ((index + 1) / stair.steps);
    pool.box(
      "stair-step",
      group,
      new Vector3(0, height / 2, -stair.run / 2 + tread * (index + 0.5)),
      new Vector3(stair.width, height, tread + 0.035),
      material,
    );
  }
}

function addBridge(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  bridge: BridgeSpec,
  materials: WorldMaterials,
): void {
  const group = new TransformNode(`${bridge.style}-bridge`, scene);
  group.parent = root;
  group.position.set(bridge.x, bridge.deckHeight, bridge.z);
  group.rotation.y = bridge.rotation;
  const deckMaterial = bridge.style === "stone" ? materials.masonry : materials.wood;
  const segments = bridge.style === "stone" ? 9 : 11;
  const segmentLength = bridge.length / segments;
  for (let index = 0; index < segments; index += 1) {
    const x = -bridge.length / 2 + segmentLength * (index + 0.5);
    const arch = bridge.style === "stone" ? Math.sin((index / (segments - 1)) * Math.PI) * 0.24 : 0;
    pool.box(
      "bridge-deck",
      group,
      new Vector3(x, arch, 0),
      new Vector3(segmentLength + 0.025, 0.18, bridge.width),
      deckMaterial,
      Vector3.Zero(),
      false,
    );
  }
  const railHeight = bridge.style === "stone" ? 0.48 : 0.68;
  for (const side of [-1, 1]) {
    const z = side * (bridge.width / 2 - 0.08);
    pool.box("bridge-rail", group, new Vector3(0, railHeight, z), new Vector3(bridge.length, 0.12, 0.13), deckMaterial);
    for (let x = -bridge.length / 2 + 0.2; x <= bridge.length / 2; x += 0.85) {
      pool.box("bridge-post", group, new Vector3(x, railHeight / 2, z), new Vector3(0.13, railHeight, 0.13), deckMaterial);
    }
  }
  for (const side of [-1, 1]) {
    pool.box(
      "bridge-pier",
      group,
      new Vector3(side * bridge.length * 0.33, -bridge.deckHeight / 2, 0),
      new Vector3(0.48, bridge.deckHeight + 0.36, bridge.width * 0.8),
      bridge.style === "stone" ? materials.masonry : materials.wood,
    );
  }
}

function addGableAttic(
  scene: Scene,
  parent: TransformNode,
  pool: PrimitivePool,
  width: number,
  depth: number,
  baseY: number,
  height: number,
  material: StandardMaterial,
): void {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const positions = [
    -halfWidth, baseY, -halfDepth,
    halfWidth, baseY, -halfDepth,
    0, baseY + height, -halfDepth,
    -halfWidth, baseY, halfDepth,
    halfWidth, baseY, halfDepth,
    0, baseY + height, halfDepth,
  ];
  const indices = [
    0, 2, 1, 3, 4, 5,
    0, 1, 4, 0, 4, 3,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
  ];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = [0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1];
  const attic = new Mesh("gable-attic", scene);
  data.applyToMesh(attic);
  attic.parent = parent;
  attic.material = material;
  attic.receiveShadows = true;
  attic.isPickable = false;
  pool.casters.push(attic);
}

function addHouse(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  item: Placement,
  materials: WorldMaterials,
): void {
  const scale = item.scale ?? 1;
  const variant = item.variant ?? 0;
  const group = new TransformNode("timber-house", scene);
  group.parent = root;
  group.position.set(item.x, item.height ?? 0, item.z);
  group.rotation.y = item.rotation ?? 0;
  group.scaling.setAll(scale);

  const width = variant === 2 ? 3.25 : 3.6;
  const depth = variant === 1 ? 3.45 : 3.05;
  const wallHeight = variant === 2 ? 2.45 : 2.65;
  const plaster = variant === 1 ? materials.plasterWarm : variant === 2 ? materials.plasterRose : materials.plaster;
  const roof = variant === 1 ? materials.roofWarm : variant === 2 ? materials.roofSlate : materials.roof;
  pool.box("house-wall", group, new Vector3(0, wallHeight / 2 + 0.18, 0), new Vector3(width, wallHeight, depth), plaster);
  pool.box("stone-foundation", group, new Vector3(0, 0.17, 0), new Vector3(width + 0.18, 0.34, depth + 0.18), materials.masonry);

  const front = -depth / 2 - 0.025;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 0.13);
    pool.box("timber-beam", group, new Vector3(x, wallHeight / 2 + 0.2, front), new Vector3(0.18, wallHeight, 0.12), materials.wood);
  }
  pool.box("timber-beam", group, new Vector3(0, wallHeight * 0.58, front), new Vector3(width, 0.17, 0.12), materials.wood);
  for (const side of [-1, 1]) {
    pool.box(
      "diagonal-brace",
      group,
      new Vector3(side * width * 0.28, wallHeight * 0.34, front - 0.01),
      new Vector3(0.14, wallHeight * 0.65, 0.13),
      materials.wood,
      new Vector3(0, 0, side * 0.55),
    );
  }
  const back = depth / 2 + 0.025;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 0.13);
    pool.box("back-timber-beam", group, new Vector3(x, wallHeight / 2 + 0.2, back), new Vector3(0.18, wallHeight, 0.12), materials.wood);
    pool.box("side-horizontal-beam", group, new Vector3(side * (width / 2 + 0.025), wallHeight * 0.58, 0), new Vector3(0.12, 0.17, depth), materials.wood);
    pool.box("side-timber-beam", group, new Vector3(side * (width / 2 + 0.025), wallHeight / 2 + 0.2, 0), new Vector3(0.12, wallHeight, 0.18), materials.wood);
    pool.box("side-window", group, new Vector3(side * (width / 2 + 0.09), 1.48, -depth * 0.2), new Vector3(0.08, 0.56, 0.62), materials.glow, Vector3.Zero(), false);
    pool.box("side-window-cross", group, new Vector3(side * (width / 2 + 0.14), 1.48, -depth * 0.2), new Vector3(0.06, 0.62, 0.08), materials.wood);
  }
  pool.box("back-horizontal-beam", group, new Vector3(0, wallHeight * 0.58, back), new Vector3(width, 0.17, 0.12), materials.wood);
  pool.box("back-window", group, new Vector3(0, 1.48, back + 0.06), new Vector3(0.7, 0.56, 0.08), materials.glow, Vector3.Zero(), false);
  pool.box("back-window-cross", group, new Vector3(0, 1.48, back + 0.11), new Vector3(0.08, 0.62, 0.06), materials.wood);

  const roofY = wallHeight + 0.73;
  const slope = 0.58;
  const panelWidth = width * 0.61;
  const ridgeY = roofY + panelWidth * 0.5 * Math.sin(slope);
  addGableAttic(
    scene,
    group,
    pool,
    width,
    depth,
    wallHeight + 0.12,
    ridgeY - wallHeight - 0.12,
    plaster,
  );
  for (const side of [-1, 1]) {
    pool.box(
      "sloped-tile-roof",
      group,
      new Vector3(side * width * 0.27, roofY, 0),
      new Vector3(panelWidth, 0.2, depth + 0.72),
      roof,
      new Vector3(0, 0, -side * slope),
    );
  }
  pool.box("roof-ridge", group, new Vector3(0, ridgeY, 0), new Vector3(0.22, 0.2, depth + 0.78), roof);
  pool.box("door", group, new Vector3(0, 0.76, front - 0.08), new Vector3(0.72, 1.45, 0.1), materials.wood);
  pool.box("door-awning", group, new Vector3(0, 2.05, front - .28), new Vector3(1.2, .12, .7), variant === 1 ? materials.canvas : roof, new Vector3(.18, 0, 0));
  for (const side of [-1, 1]) {
    pool.box("warm-window", group, new Vector3(side * width * 0.29, 1.55, front - 0.09), new Vector3(0.62, 0.58, 0.08), materials.glow, Vector3.Zero(), false);
    pool.box("window-cross", group, new Vector3(side * width * 0.29, 1.55, front - 0.14), new Vector3(0.08, 0.64, 0.06), materials.wood);
    pool.box("window-shutter", group, new Vector3(side * width * .29 - .4, 1.55, front - .13), new Vector3(.16, .64, .07), roof);
    pool.box("window-shutter", group, new Vector3(side * width * .29 + .4, 1.55, front - .13), new Vector3(.16, .64, .07), roof);
    pool.box("window-box", group, new Vector3(side * width * .29, 1.2, front - .15), new Vector3(.78, .16, .18), materials.wood, Vector3.Zero(), false);
    pool.add("sphere", "window-flowers", group, new Vector3(side * width * .29, 1.31, front - .2), new Vector3(.48, .16, .13), materials.flower, Vector3.Zero(), false);
  }
  const chimneyX = variant % 2 ? -width * 0.28 : width * 0.28;
  pool.box("chimney", group, new Vector3(chimneyX, roofY + 0.75, 0.35), new Vector3(0.42, 1.2, 0.48), materials.masonry);
  if (variant !== 2) {
    pool.box("dormer", group, new Vector3(-chimneyX * .55, roofY + .23, front * .35), new Vector3(.72, .62, .65), plaster);
    pool.box("dormer-roof", group, new Vector3(-chimneyX * .55, roofY + .58, front * .35), new Vector3(.92, .16, .84), roof, new Vector3(.25, 0, 0));
  }
}

function addTree(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  item: Placement,
  materials: WorldMaterials,
): void {
  const scale = item.scale ?? 1;
  const variant = item.variant ?? 0;
  const group = new TransformNode("tree", scene);
  group.parent = root;
  group.position.set(item.x, item.height ?? 0, item.z);
  group.rotation.y = item.rotation ?? 0;
  group.scaling.setAll(scale);
  const trunkHeight = variant === 1 ? 3.05 : 2.6;
  pool.add("cylinder", "tree-trunk", group, new Vector3(0, trunkHeight / 2, 0), new Vector3(.46, trunkHeight, .46), materials.wood);
  for (const [x, y, angle] of [[-.42, 1.75, -.82], [.38, 2.02, .88], [.12, 2.3, .38]] as const) {
    pool.add("cylinder", "tree-branch", group, new Vector3(x, y, .03), new Vector3(.18, .82, .18), materials.wood, new Vector3(0, 0, angle));
  }
  const crowns = variant === 1
    ? [[0, 2.35, 1.25, .92, 1.12], [-.62, 2.72, .84, .72, .8], [.66, 2.66, .9, .76, .82], [.08, 3.3, .96, .76, .94]] as const
    : [[-.72, 2.42, .92, .72, .82], [-.18, 2.7, 1.12, .86, 1.02], [.6, 2.5, .98, .78, .9], [.13, 3.36, 1.08, .78, .96], [-.42, 3.66, .72, .58, .7], [.76, 3.28, .7, .58, .68]] as const;
  crowns.forEach(([x, y, width, height, depth], index) => {
    pool.add("sphere", "foliage-crown", group, new Vector3(x, y, index % 2 ? .16 : -.12), new Vector3(width, height, depth), index % 3 === 0 ? materials.darkLeaf : materials.leaf);
  });
  for (const [x, y, z, width, height] of [[-.92, 2.65, -.16, 1.05, .72], [.82, 2.82, .1, 1.02, .72], [.02, 3.7, .06, 1.12, .72]] as const) {
    pool.add("plane", "leaf-silhouette", group, new Vector3(x, y, z), new Vector3(width, height, 1), materials.leafCard, new Vector3(0, item.rotation ?? 0, 0), false);
  }
}

function addCaveWallMesh(scene: Scene, group: TransformNode, pool: PrimitivePool, materials: WorldMaterials): void {
  type CaveWallProfile = Readonly<{
    frontFoot: Vector3;
    frontShelf: Vector3;
    frontUpper: Vector3;
    frontTop: Vector3;
    backTop: Vector3;
    backFoot: Vector3;
  }>;
  const xs = [-2.35, -1.65, -.9, -.15, .6, 1.35, 2.35];
  const fronts = [-.62, -.78, -.7, -.88, -.68, -.82, -.6];
  const backs = [.7, .62, .84, .68, .9, .66, .76];
  const tops = [2.25, 2.85, 2.5, 3.18, 2.68, 3, 2.3];
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const addFace = (points: readonly Vector3[]) => {
    const start = positions.length / 3;
    for (const point of points) positions.push(point.x, point.y, point.z);
    const width = Math.max(.1, points[points.length - 1].subtract(points[0]).length());
    uvs.push(0, 0, 0, 1, width, 1, width, 0);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  const profile = (index: number): CaveWallProfile => {
    const x = xs[index];
    const front = fronts[index];
    const back = backs[index];
    return {
      frontFoot: new Vector3(x, 0, front - .06),
      frontShelf: new Vector3(x, .56, front - .3),
      frontUpper: new Vector3(x, .74, front - .03),
      frontTop: new Vector3(x, tops[index], front),
      backTop: new Vector3(x, tops[index] - .08, back),
      backFoot: new Vector3(x, 0, back + .04),
    };
  };
  const profiles = xs.map((_, index) => profile(index));
  for (let index = 0; index < profiles.length - 1; index += 1) {
    const left = profiles[index];
    const right = profiles[index + 1];
    addFace([left.frontFoot, left.frontShelf, right.frontShelf, right.frontFoot]);
    addFace([left.frontShelf, left.frontUpper, right.frontUpper, right.frontShelf]);
    addFace([left.frontUpper, left.frontTop, right.frontTop, right.frontUpper]);
    addFace([left.frontTop, left.backTop, right.backTop, right.frontTop]);
    addFace([left.backFoot, right.backFoot, right.backTop, left.backTop]);
    addFace([left.frontFoot, right.frontFoot, right.backFoot, left.backFoot]);
  }
  const addCap = (wallProfile: CaveWallProfile, reverse: boolean) => {
    const ring = [wallProfile.frontFoot, wallProfile.frontShelf, wallProfile.frontUpper, wallProfile.frontTop, wallProfile.backTop, wallProfile.backFoot];
    const center = ring.reduce((sum, point) => sum.add(point), Vector3.Zero()).scale(1 / ring.length);
    for (let index = 0; index < ring.length; index += 1) {
      const start = positions.length / 3;
      const first = ring[index];
      const second = ring[(index + 1) % ring.length];
      for (const point of [center, reverse ? second : first, reverse ? first : second]) positions.push(point.x, point.y, point.z);
      uvs.push(.5, .5, 0, 0, 1, 0);
      indices.push(start, start + 1, start + 2);
    }
  };
  addCap(profiles[0], true);
  addCap(profiles[profiles.length - 1], false);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.uvs = uvs;
  const wall = new Mesh("continuous-irregular-cave-wall", scene);
  data.applyToMesh(wall);
  wall.parent = group;
  wall.material = materials.caveWall;
  wall.receiveShadows = true;
  wall.isPickable = false;
  pool.casters.push(wall);
  for (const [x, z, width, depth, rotation] of [[-1.55, -.88, .72, .5, -.18], [.35, -1.02, .9, .42, .12], [1.55, -.78, .58, .46, -.26]] as const) {
    pool.box("wall-foot-rubble", group, new Vector3(x, .13, z), new Vector3(width, .26, depth), materials.caveWall, new Vector3(.08, rotation, .04));
  }
}

function addCaveForm(scene: Scene, root: TransformNode, pool: PrimitivePool, item: Placement, materials: WorldMaterials, withLight: boolean): void {
  const scale = item.scale ?? 1;
  const y = item.height ?? 0;
  if (item.kind === "caveWall") {
    const group = new TransformNode("continuous-cave-wall", scene);
    group.parent = root;
    group.position.set(item.x, y, item.z);
    group.rotation.y = item.rotation ?? 0;
    group.scaling.setAll(scale);
    addCaveWallMesh(scene, group, pool, materials);
  } else if (item.kind === "caveArch") {
    const group = new TransformNode("cave-arch", scene);
    group.parent = root;
    group.position.set(item.x, y, item.z);
    group.rotation.y = item.rotation ?? 0;
    for (const side of [-1, 1]) pool.box("arch-pier", group, new Vector3(side * 1.35 * scale, 1.65 * scale, 0), new Vector3(.85 * scale, 3.3 * scale, 1.35 * scale), materials.caveWall);
    pool.box("arch-lintel", group, new Vector3(0, 3.45 * scale, 0), new Vector3(3.55 * scale, .9 * scale, 1.5 * scale), materials.caveWall);
    for (const [x, height] of [[-.82, .85], [0, 1.2], [.76, .7]] as const) {
      pool.add("cone", "attached-stalactite", group, new Vector3(x * scale, (3.05 - height / 2) * scale, 0), new Vector3(.42 * scale, height * scale, .42 * scale), materials.caveRock, new Vector3(0, 0, Math.PI));
    }
  } else if (item.kind === "stalagmite") {
    for (const [x, z, height] of [[0, 0, 1.9], [.65, .18, 1.15], [-.55, .28, .9]] as const) {
      pool.add("cone", "grounded-stalagmite", root, new Vector3(item.x + x * scale, y + height * scale / 2, item.z + z * scale), new Vector3(.8 * scale, height * scale, .8 * scale), materials.caveRock);
    }
  } else if (item.kind === "crystal") {
    for (const [x, height, z] of [[0, 1.7, 0], [.42, 1.15, .12], [-.38, .9, .22]] as const) pool.add("cone", "crystal-cluster", root, new Vector3(item.x + x * scale, y + height * scale / 2, item.z + z * scale), new Vector3(.58 * scale, height * scale, .58 * scale), materials.crystal, new Vector3(0, item.rotation ?? 0, 0));
    if (withLight) {
      const light = new PointLight("crystal-light", new Vector3(item.x, y + 1.15 * scale, item.z), scene);
      light.parent = root;
      light.diffuse = Color3.FromHexString("#79bde1");
      light.intensity = .48;
      light.range = 4.5;
    }
  } else if (item.kind === "log") {
    pool.add("cylinder", "fallen-log", root, new Vector3(item.x, y + .28 * scale, item.z), new Vector3(.48 * scale, 2.1 * scale, .48 * scale), materials.wood, new Vector3(0, 0, Math.PI / 2));
  }
}

function addLantern(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  item: Placement,
  materials: WorldMaterials,
  withLight: boolean,
  caveLight = false,
): void {
  const y = item.height ?? 0;
  pool.box("lantern-post", root, new Vector3(item.x, y + 1.05, item.z), new Vector3(0.14, 2.1, 0.14), materials.iron);
  pool.box("lantern-arm", root, new Vector3(item.x + 0.22, y + 1.92, item.z), new Vector3(0.5, 0.11, 0.11), materials.iron);
  pool.box("lantern-glow", root, new Vector3(item.x + 0.42, y + 1.7, item.z), new Vector3(0.36, 0.48, 0.36), materials.glow, Vector3.Zero(), false);
  if (withLight) {
    const light = new PointLight("lantern-light", new Vector3(item.x + 0.42, y + 1.85, item.z), scene);
    light.parent = root;
    light.diffuse = Color3.FromHexString("#ffbd73");
    light.intensity = caveLight ? 1.15 : 0.4;
    light.range = caveLight ? 6.2 : 4.5;
  }
}

function addMarket(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  item: Placement,
  materials: WorldMaterials,
): void {
  const group = new TransformNode("market-stall", scene);
  group.parent = root;
  group.position.set(item.x, item.height ?? 0, item.z);
  group.rotation.y = item.rotation ?? 0;
  group.scaling.setAll(item.scale ?? 1);
  pool.box("stall-counter", group, new Vector3(0, 0.72, 0), new Vector3(2.2, 0.18, 0.9), materials.wood);
  for (const x of [-0.95, 0.95]) {
    pool.box("stall-post", group, new Vector3(x, 1.25, 0), new Vector3(0.13, 2.4, 0.13), materials.wood);
  }
  pool.box("stall-awning", group, new Vector3(0, 2.25, 0), new Vector3(2.55, 0.14, 1.55), materials.canvas, new Vector3(0, 0, 0.08));
  for (let index = -2; index <= 2; index += 1) {
    pool.add("sphere", "market-produce", group, new Vector3(index * 0.32, 0.92, -0.1), new Vector3(0.22, 0.18, 0.22), materials.flower, Vector3.Zero(), false);
  }
}

function addRuin(
  scene: Scene,
  root: TransformNode,
  pool: PrimitivePool,
  item: Placement,
  materials: WorldMaterials,
): void {
  const group = new TransformNode("ruin", scene);
  group.parent = root;
  group.position.set(item.x, item.height ?? 0, item.z);
  group.rotation.y = item.rotation ?? 0;
  group.scaling.setAll(item.scale ?? 1);
  pool.box("broken-wall", group, new Vector3(0, 0.85, 0), new Vector3(2.7, 1.7, 0.38), materials.masonry);
  pool.box("ruin-column", group, new Vector3(-1.2, 1.25, 0.55), new Vector3(0.42, 2.5, 0.42), materials.masonry);
  pool.box("ruin-column", group, new Vector3(1.15, 0.75, 0.5), new Vector3(0.42, 1.5, 0.42), materials.masonry);
  pool.box("fallen-stone", group, new Vector3(0.75, 0.22, 1), new Vector3(1.25, 0.35, 0.5), materials.masonry, new Vector3(0.08, 0.35, 0.12));
}

function addSmallProp(
  root: TransformNode,
  pool: PrimitivePool,
  item: Placement,
  materials: WorldMaterials,
): void {
  const scale = item.scale ?? 1;
  const y = item.height ?? 0;
  if (item.kind === "rock") {
    pool.add("rock", "rock", root, new Vector3(item.x, y + 0.45 * scale, item.z), new Vector3(1.3 * scale, 0.9 * scale, 1.05 * scale), materials.masonry, new Vector3(0, item.rotation ?? 0, 0));
  } else if (item.kind === "stump") {
    pool.add("cylinder", "stump", root, new Vector3(item.x, y + 0.38 * scale, item.z), new Vector3(0.9 * scale, 0.76 * scale, 0.9 * scale), materials.wood);
  } else if (item.kind === "shrub") {
    for (let index = -1; index <= 1; index += 1) {
      pool.add("sphere", "shrub", root, new Vector3(item.x + index * 0.38 * scale, y + 0.38 * scale + Math.abs(index) * 0.08, item.z), new Vector3(0.85 * scale, 0.62 * scale, 0.72 * scale), index === 0 ? materials.leaf : materials.darkLeaf);
    }
  } else if (item.kind === "barrels") {
    pool.add("cylinder", "barrel", root, new Vector3(item.x, y + 0.43 * scale, item.z), new Vector3(0.66 * scale, 0.86 * scale, 0.66 * scale), materials.wood);
    pool.box("crate", root, new Vector3(item.x + 0.7 * scale, y + 0.35 * scale, item.z + 0.18 * scale), new Vector3(0.7 * scale, 0.7 * scale, 0.7 * scale), materials.wood);
  } else if (item.kind === "log") {
    pool.add("cylinder", "fallen-log", root, new Vector3(item.x, y + .28 * scale, item.z), new Vector3(.48 * scale, 2.1 * scale, .48 * scale), materials.wood, new Vector3(0, 0, Math.PI / 2));
  }
}

export function createWorld(scene: Scene, definition: MapDefinition, lightweight: boolean): WorldHandle {
  const root = new TransformNode(`world-${definition.id}`, scene);
  const materials = createWorldMaterials(scene);
  const pool = new PrimitivePool(scene, root);
  const animated: InstancedMesh[] = [];
  const waterMaterial = addTerrain(scene, root, pool, definition, materials);

  for (const stair of definition.stairs) addStairs(scene, root, pool, stair, materials.masonry);
  for (const bridge of definition.bridges) addBridge(scene, root, pool, bridge, materials);

  let lanternLights = 0;
  let crystalLights = 0;
  for (const item of definition.placements) {
    if (item.kind === "house") addHouse(scene, root, pool, item, materials);
    else if (item.kind === "tree") addTree(scene, root, pool, item, materials);
    else if (item.kind === "lantern") {
      const useLight = definition.id === "cave" ? lanternLights++ < 2 : lanternLights++ < 2 && !lightweight;
      addLantern(scene, root, pool, item, materials, useLight, definition.id === "cave");
    }
    else if (item.kind === "market") addMarket(scene, root, pool, item, materials);
    else if (item.kind === "ruin") addRuin(scene, root, pool, item, materials);
    else if (["caveWall", "caveArch", "stalagmite", "crystal"].includes(item.kind)) {
      const useLight = item.kind === "crystal" && crystalLights++ < 1;
      addCaveForm(scene, root, pool, item, materials, useLight);
    }
    else if (item.kind === "flowers") {
      const count = lightweight ? 3 : 7;
      for (let index = 0; index < count; index += 1) {
        const angle = index * 2.399;
        const radius = 0.15 + index * 0.08;
        const flower = pool.add("sphere", "flower", root, new Vector3(item.x + Math.cos(angle) * radius, (item.height ?? 0) + 0.12, item.z + Math.sin(angle) * radius), new Vector3(0.13, 0.19, 0.13), index % 2 ? materials.flower : materials.glow, Vector3.Zero(), false);
        animated.push(flower);
      }
    } else {
      addSmallProp(root, pool, item, materials);
    }
  }

  if (definition.id === "forest") {
    const random = seeded(definition.seed);
    const count = lightweight ? 20 : 46;
    for (let index = 0; index < count; index += 1) {
      const x = -9 + random() * 18;
      const z = -9 + random() * 18;
      if (Math.abs(x - definition.waterway.center) < 1.7 || Math.abs(x + 4) < 1.5) continue;
      const terrainHeight = solidTerrainHeightAt(definition, x, z) ?? 0;
      const grass = pool.add("cone", "grass-tuft", root, new Vector3(x, terrainHeight + 0.18, z), new Vector3(0.16 + random() * 0.16, 0.36 + random() * 0.18, 0.16 + random() * 0.16), random() > 0.5 ? materials.leaf : materials.darkLeaf, Vector3.Zero(), false);
      if (!lightweight && random() > 0.82) animated.push(grass);
    }
  }

  const animatedBaseY = animated.map((mesh) => mesh.position.y);
  const update = (elapsedSeconds: number): void => {
    const texture = waterMaterial.diffuseTexture as import("@babylonjs/core").Texture | null;
    if (texture) texture.vOffset = (elapsedSeconds * 0.035) % 1;
    for (let index = 0; index < animated.length; index += 1) {
      const mesh = animated[index];
      mesh.position.y = animatedBaseY[index] + Math.sin(elapsedSeconds * 1.4 + index * 1.7) * 0.02;
      mesh.rotation.y = elapsedSeconds * 0.2 + index;
    }
  };

  return {
    root,
    bounds: definition.id === "town" ? 13.5 : 14,
    target: new Vector3(definition.cameraTarget.x, definition.cameraTarget.y, definition.cameraTarget.z),
    shadowCasters: pool.casters,
    walk: createMapWalkSurface(definition),
    update,
    dispose: () => {
      root.dispose(false, false);
      for (const material of Object.values(materials)) material.dispose(true, true);
    },
  };
}
