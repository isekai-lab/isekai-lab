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
import { seeded } from "./definitions.ts";
import { createWorldMaterials, type WorldMaterials } from "./materials.ts";
import { createMapWalkSurface } from "./walk.ts";

export type WorldHandle = {
  root: TransformNode;
  bounds: number;
  target: Vector3;
  shadowCasters: readonly AbstractMesh[];
  walk: WalkSurface;
  update: (elapsedSeconds: number) => void;
  dispose: () => void;
};

type PrimitiveKind = "box" | "cylinder" | "sphere" | "cone" | "rock";

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

function addPath(
  scene: Scene,
  root: TransformNode,
  definition: MapDefinition,
  materials: WorldMaterials,
): void {
  for (const path of definition.paths) {
    const left: number[] = [];
    const right: number[] = [];
    for (let index = 0; index < path.points.length; index += 1) {
      const previous = path.points[Math.max(0, index - 1)];
      const next = path.points[Math.min(path.points.length - 1, index + 1)];
      const length = Math.hypot(next.x - previous.x, next.z - previous.z) || 1;
      const offsetX = (next.z - previous.z) / length * path.width / 2;
      const offsetZ = -(next.x - previous.x) / length * path.width / 2;
      left.push(path.points[index].x + offsetX, .05, path.points[index].z + offsetZ);
      right.push(path.points[index].x - offsetX, .05, path.points[index].z - offsetZ);
    }
    const positions = left.flatMap((value, index) => index % 3 === 0 ? [value, left[index + 1], left[index + 2], right[index], right[index + 1], right[index + 2]] : []);
    const indices: number[] = [];
    for (let index = 0; index < path.points.length - 1; index += 1) indices.push(index * 2, index * 2 + 1, index * 2 + 2, index * 2 + 1, index * 2 + 3, index * 2 + 2);
    const data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = Array.from({ length: positions.length }, (_, index) => index % 3 === 1 ? 1 : 0);
    data.uvs = Array.from({ length: path.points.length }, (_, index) => [0, index, 1, index]).flat();
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
      level.material === "stone" ? materials.masonry : materials.grass,
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
  pool.box("house-wall", group, new Vector3(0, wallHeight / 2 + 0.18, 0), new Vector3(width, wallHeight, depth), materials.plaster);
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
    materials.plaster,
  );
  for (const side of [-1, 1]) {
    pool.box(
      "sloped-tile-roof",
      group,
      new Vector3(side * width * 0.27, roofY, 0),
      new Vector3(panelWidth, 0.2, depth + 0.72),
      materials.roof,
      new Vector3(0, 0, -side * slope),
    );
  }
  pool.box("roof-ridge", group, new Vector3(0, ridgeY, 0), new Vector3(0.22, 0.2, depth + 0.78), materials.roof);
  pool.box("door", group, new Vector3(0, 0.76, front - 0.08), new Vector3(0.72, 1.45, 0.1), materials.wood);
  pool.box("door-awning", group, new Vector3(0, 2.05, front - .28), new Vector3(1.2, .12, .7), variant === 1 ? materials.canvas : materials.roof, new Vector3(.18, 0, 0));
  for (const side of [-1, 1]) {
    pool.box("warm-window", group, new Vector3(side * width * 0.29, 1.55, front - 0.09), new Vector3(0.62, 0.58, 0.08), materials.glow, Vector3.Zero(), false);
    pool.box("window-cross", group, new Vector3(side * width * 0.29, 1.55, front - 0.14), new Vector3(0.08, 0.64, 0.06), materials.wood);
    pool.box("window-box", group, new Vector3(side * width * .29, 1.2, front - .15), new Vector3(.78, .16, .18), materials.wood, Vector3.Zero(), false);
    pool.add("sphere", "window-flowers", group, new Vector3(side * width * .29, 1.31, front - .2), new Vector3(.48, .16, .13), materials.flower, Vector3.Zero(), false);
  }
  const chimneyX = variant % 2 ? -width * 0.28 : width * 0.28;
  pool.box("chimney", group, new Vector3(chimneyX, roofY + 0.75, 0.35), new Vector3(0.42, 1.2, 0.48), materials.masonry);
  if (variant !== 2) {
    pool.box("dormer", group, new Vector3(-chimneyX * .55, roofY + .23, front * .35), new Vector3(.72, .62, .65), materials.plaster);
    pool.box("dormer-roof", group, new Vector3(-chimneyX * .55, roofY + .58, front * .35), new Vector3(.92, .16, .84), materials.roof, new Vector3(.25, 0, 0));
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
  const trunkHeight = variant === 1 ? 3.15 : 2.55;
  pool.add("cylinder", "tree-trunk", group, new Vector3(0, trunkHeight / 2, 0), new Vector3(0.5, trunkHeight, 0.5), materials.wood);
  for (const side of [-1, 1]) pool.add("cone", "tree-branch", group, new Vector3(side * .52, trunkHeight * .58, .05), new Vector3(.24, 1.25, .24), materials.wood, new Vector3(0, 0, side * 1.05));
  if (variant === 1) {
    pool.add("cone", "fir-crown", group, new Vector3(0, 2.4, 0), new Vector3(2.9, 2.7, 2.9), materials.darkLeaf);
    pool.add("cone", "fir-crown", group, new Vector3(0, 3.45, 0), new Vector3(2.2, 2.4, 2.2), materials.leaf);
  } else if (variant === 2) {
    pool.add("sphere", "oak-crown", group, new Vector3(-0.55, 2.55, 0.05), new Vector3(2.15, 1.55, 1.8), materials.darkLeaf);
    pool.add("sphere", "oak-crown", group, new Vector3(0.55, 2.75, 0.15), new Vector3(2.35, 1.75, 2), materials.leaf);
    pool.add("sphere", "oak-crown", group, new Vector3(0, 3.55, -0.15), new Vector3(2.25, 1.65, 1.85), materials.leaf);
  } else {
    pool.add("sphere", "broadleaf-crown", group, new Vector3(-0.42, 2.55, 0), new Vector3(2.3, 1.65, 1.95), materials.darkLeaf);
    pool.add("sphere", "broadleaf-crown", group, new Vector3(0.55, 2.75, 0.12), new Vector3(2.5, 1.8, 2.05), materials.leaf);
  }
}

function addCaveForm(root: TransformNode, pool: PrimitivePool, item: Placement, materials: WorldMaterials): void {
  const scale = item.scale ?? 1;
  const y = item.height ?? 0;
  if (item.kind === "caveWall") {
    for (let index = -1; index <= 1; index += 1) {
      pool.add("rock", "stratified-cave-wall", root, new Vector3(item.x + index * .8 * scale, y + 1.55 * scale + Math.abs(index) * .22, item.z + (index % 2) * .32), new Vector3(2.25 * scale, 3.1 * scale, 1.35 * scale), materials.caveRock, new Vector3(.05 * index, item.rotation ?? 0, .14 * index));
    }
  } else if (item.kind === "stalagmite") {
    pool.add("cone", "stalagmite", root, new Vector3(item.x, y + 1.05 * scale, item.z), new Vector3(1.25 * scale, 2.1 * scale, 1.25 * scale), materials.caveRock);
    pool.add("cone", "stalactite", root, new Vector3(item.x + .8 * scale, y + 4.1 * scale, item.z - .35), new Vector3(.72 * scale, 1.8 * scale, .72 * scale), materials.caveRock, new Vector3(Math.PI, 0, 0));
  } else if (item.kind === "crystal") {
    for (const [x, height, z] of [[0, 1.7, 0], [.42, 1.15, .12], [-.38, .9, .22]] as const) pool.add("cone", "crystal-cluster", root, new Vector3(item.x + x * scale, y + height * scale / 2, item.z + z * scale), new Vector3(.58 * scale, height * scale, .58 * scale), materials.crystal, new Vector3(0, item.rotation ?? 0, 0));
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
): void {
  const y = item.height ?? 0;
  pool.box("lantern-post", root, new Vector3(item.x, y + 1.05, item.z), new Vector3(0.14, 2.1, 0.14), materials.iron);
  pool.box("lantern-arm", root, new Vector3(item.x + 0.22, y + 1.92, item.z), new Vector3(0.5, 0.11, 0.11), materials.iron);
  pool.box("lantern-glow", root, new Vector3(item.x + 0.42, y + 1.7, item.z), new Vector3(0.36, 0.48, 0.36), materials.glow, Vector3.Zero(), false);
  if (withLight) {
    const light = new PointLight("lantern-light", new Vector3(item.x + 0.42, y + 1.85, item.z), scene);
    light.parent = root;
    light.diffuse = Color3.FromHexString("#ffbd73");
    light.intensity = 0.4;
    light.range = 4.5;
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
  for (const item of definition.placements) {
    if (item.kind === "house") addHouse(scene, root, pool, item, materials);
    else if (item.kind === "tree") addTree(scene, root, pool, item, materials);
    else if (item.kind === "lantern") addLantern(scene, root, pool, item, materials, lanternLights++ < 2 && !lightweight);
    else if (item.kind === "market") addMarket(scene, root, pool, item, materials);
    else if (item.kind === "ruin") addRuin(scene, root, pool, item, materials);
    else if (["caveWall", "stalagmite", "crystal"].includes(item.kind)) addCaveForm(root, pool, item, materials);
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
      const grass = pool.add("cone", "grass-tuft", root, new Vector3(x, 0.18, z), new Vector3(0.16 + random() * 0.16, 0.36 + random() * 0.18, 0.16 + random() * 0.16), random() > 0.5 ? materials.leaf : materials.darkLeaf, Vector3.Zero(), false);
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
