import { MeshBuilder, StandardMaterial, Color3, TransformNode, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { WalkSurface } from "../contracts/index.ts";
/** Visual proxy is intentionally separate from the walk/collision contract. */
export function createCharacterFixture(scene: Scene, walk: WalkSurface): {
    root: TransformNode;
    move: (x: number, z: number) => void;
    dispose: () => void;
} {
    const root = new TransformNode("character-fixture", scene);
    root.position.set(walk.spawn.x, walk.spawn.y, walk.spawn.z);
    const material = new StandardMaterial("character-proxy", scene);
    material.diffuseColor = Color3.FromHexString("#f3c36b");
    material.specularColor = Color3.Black();
    const body = MeshBuilder.CreateCylinder("character-body", { height: .65, diameter: .38, tessellation: 8 }, scene);
    body.parent = root;
    body.position.y = .325;
    body.material = material;
    const head = MeshBuilder.CreateSphere("character-head", { diameter: .35, segments: 8 }, scene);
    head.parent = root;
    head.position.y = .825;
    head.material = material;
    return { root, move(x, z) { const y = walk.heightAt(x, z); if (y !== undefined)
            root.position.set(x, y, z); }, dispose() { root.dispose(); material.dispose(); } };
}
