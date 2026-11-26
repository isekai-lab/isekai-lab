import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { AbstractMesh, Scene } from "@babylonjs/core";
import type { WorldHandle } from "../maps/world.ts";
import { createWalkCourse } from "./walk-course.ts";

export function createWalkCourseWorld(scene: Scene): WorldHandle {
  const root = new TransformNode("walk-course-world", scene);
  const walk = createWalkCourse();
  const casters: AbstractMesh[] = [];
  const materials = {
    road: material(scene, "course-road", "#6d746f"),
    platform: material(scene, "course-platform", "#8b8170"),
    water: material(scene, "course-water", "#287789"),
    bridge: material(scene, "course-bridge", "#8f7657"),
    pillar: material(scene, "course-pillar", "#af8f54"),
  };
  materials.water.alpha = .82;
  const box = (name: string, position: Vector3, size: Vector3, materialValue: StandardMaterial, casts = false) => {
    const mesh = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
    mesh.parent = root;
    mesh.position.copyFrom(position);
    mesh.material = materialValue;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    if (casts) casters.push(mesh);
    return mesh;
  };
  box("lower-road", new Vector3(0, -.08, -3.55), new Vector3(16, .16, 4.9), materials.road);
  box("upper-road", new Vector3(0, -.08, 3.55), new Vector3(16, .16, 4.9), materials.road);
  box("right-bank", new Vector3(4, -.08, 0), new Vector3(8, .16, 2.2), materials.road);
  box("course-water", new Vector3(-4, -.03, 0), new Vector3(8, .06, 2.2), materials.water);
  box("platform", new Vector3(3, 1, 3.4), new Vector3(4, 2, 3.2), materials.platform, true);
  for (let index = 0; index < 4; index += 1) {
    const height = .5 * (index + 1);
    box("stair", new Vector3(2, height / 2, -1.5 + index), new Vector3(2, height, 1.02), materials.platform, true);
  }
  for (let index = 0; index < 9; index += 1) {
    const height = .4 + Math.sin((index / 8) * Math.PI) * .24;
    box("bridge-segment", new Vector3(-5 + (index + .5) * (5 / 9), height, 0), new Vector3(5 / 9 + .025, .18, 1.5), materials.bridge, true);
  }
  const pillar = MeshBuilder.CreateCylinder("course-pillar", { diameter: 1.6, height: 3, tessellation: 12 }, scene);
  pillar.parent = root;
  pillar.position.set(0, 1.5, 3);
  pillar.material = materials.pillar;
  pillar.receiveShadows = true;
  pillar.isPickable = false;
  casters.push(pillar);
  return {
    root,
    bounds: 9,
    target: new Vector3(0, .8, 0),
    shadowCasters: casters,
    walk,
    update: () => undefined,
    dispose: () => {
      root.dispose(false, false);
      for (const value of Object.values(materials)) value.dispose();
    },
  };
}

function material(scene: Scene, name: string, color: string): StandardMaterial {
  const value = new StandardMaterial(name, scene);
  value.diffuseColor = Color3.FromHexString(color);
  value.specularColor = Color3.Black();
  return value;
}
