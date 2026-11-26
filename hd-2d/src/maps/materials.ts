import { Color3, DynamicTexture, StandardMaterial, Texture } from "@babylonjs/core";
import type { ICanvasRenderingContext, Scene } from "@babylonjs/core";

export type MaterialName =
  | "grass" | "cobble" | "groundCobble" | "masonry" | "dirt" | "water" | "wood"
  | "plaster" | "roof" | "leaf" | "darkLeaf" | "glow" | "flower"
  | "canvas" | "iron";
export type WorldMaterials = Record<MaterialName, StandardMaterial>;

type Painter = (context: ICanvasRenderingContext, size: number) => void;

function textureMaterial(
  scene: Scene,
  name: MaterialName,
  base: string,
  painter: Painter,
  tiles = 4,
): StandardMaterial {
  const size = 64;
  const texture = new DynamicTexture(
    `pixel-${name}`,
    { width: size, height: size },
    scene,
    false,
    Texture.NEAREST_SAMPLINGMODE,
  );
  const context = texture.getContext();
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);
  painter(context, size);
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = tiles;
  texture.vScale = tiles;

  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.specularColor = Color3.Black();
  material.ambientColor = Color3.FromHexString("#30363a");
  material.maxSimultaneousLights = 3;
  return material;
}

function masonry(context: ICanvasRenderingContext, size: number, mortar: string, stone: string): void {
  context.fillStyle = mortar;
  for (let y = 0; y < size; y += 10) {
    context.fillRect(0, y, size, 2);
    const offset = (y / 10) % 2 ? 7 : 0;
    for (let x = offset; x < size; x += 14) context.fillRect(x, y, 2, 10);
  }
  context.fillStyle = stone;
  for (let y = 4; y < size; y += 20) {
    for (let x = (y / 4) % 9; x < size; x += 18) context.fillRect(x, y, 4, 2);
  }
}

export function createWorldMaterials(scene: Scene): WorldMaterials {
  const grass = textureMaterial(scene, "grass", "#315944", (c, size) => {
    c.fillStyle = "#426c4c";
    for (let y = 2; y < size; y += 7) for (let x = (y * 3) % 9; x < size; x += 11) c.fillRect(x, y, 2, 4);
    c.fillStyle = "#233f35";
    for (let y = 5; y < size; y += 13) c.fillRect((y * 5) % size, y, 3, 2);
  }, 6);
  const cobble = textureMaterial(scene, "cobble", "#707a7c", (c, size) => {
    masonry(c, size, "#48565a", "#929a95");
  }, 5);
  const groundCobble = textureMaterial(scene, "groundCobble", "#707a7c", (c, size) => {
    masonry(c, size, "#48565a", "#929a95");
  }, 15);
  const masonryMaterial = textureMaterial(scene, "masonry", "#6a7475", (c, size) => {
    masonry(c, size, "#3f4b50", "#89918d");
  }, 3);
  const dirt = textureMaterial(scene, "dirt", "#79583e", (c, size) => {
    c.fillStyle = "#9b7450";
    for (let y = 3; y < size; y += 9) for (let x = (y * 2) % 12; x < size; x += 15) c.fillRect(x, y, 4, 2);
    c.fillStyle = "#503d31";
    for (let y = 8; y < size; y += 16) c.fillRect((y * 7) % size, y, 3, 3);
  }, 4);
  const water = textureMaterial(scene, "water", "#286b78", (c, size) => {
    c.fillStyle = "#4b9aa0";
    for (let y = 4; y < size; y += 10) {
      for (let x = (y * 3) % 16; x < size; x += 22) c.fillRect(x, y, 11, 2);
    }
    c.fillStyle = "#174f63";
    for (let y = 9; y < size; y += 20) c.fillRect((y * 5) % 24, y, 15, 2);
  }, 3);
  water.alpha = 0.88;
  water.specularColor = Color3.FromHexString("#6bb1b5");
  water.specularPower = 32;

  const wood = textureMaterial(scene, "wood", "#6c472f", (c, size) => {
    c.fillStyle = "#9b6941";
    for (let x = 4; x < size; x += 10) c.fillRect(x, 0, 2, size);
    c.fillStyle = "#402d24";
    for (let y = 8; y < size; y += 18) {
      c.fillRect(0, y, size, 2);
      c.fillRect((y * 2) % 45, y - 2, 7, 2);
    }
  }, 3);
  const plaster = textureMaterial(scene, "plaster", "#d5c7a5", (c, size) => {
    c.fillStyle = "#bba986";
    for (let y = 5; y < size; y += 13) for (let x = (y * 2) % 17; x < size; x += 23) c.fillRect(x, y, 3, 2);
    c.fillStyle = "#e6d9b8";
    for (let y = 11; y < size; y += 21) c.fillRect((y * 3) % 50, y, 6, 2);
  }, 3);
  const roof = textureMaterial(scene, "roof", "#28636a", (c, size) => {
    c.strokeStyle = "#163f49";
    c.lineWidth = 2;
    for (let y = 0; y < size; y += 10) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(size, y);
      c.stroke();
      const offset = (y / 10) % 2 ? 5 : 0;
      for (let x = offset; x < size; x += 10) c.fillRect(x, y, 2, 10);
    }
    c.fillStyle = "#4f8d86";
    for (let y = 3; y < size; y += 20) for (let x = 3; x < size; x += 20) c.fillRect(x, y, 5, 2);
  }, 3);
  const leafPainter = (light: string, dark: string): Painter => (c, size) => {
    c.fillStyle = light;
    for (let y = 3; y < size; y += 8) for (let x = (y * 3) % 10; x < size; x += 13) c.fillRect(x, y, 4, 3);
    c.fillStyle = dark;
    for (let y = 6; y < size; y += 13) c.fillRect((y * 7) % size, y, 5, 4);
  };
  const leaf = textureMaterial(scene, "leaf", "#245c42", leafPainter("#43805a", "#163d31"), 4);
  const darkLeaf = textureMaterial(scene, "darkLeaf", "#1c493b", leafPainter("#346b4d", "#102f2a"), 4);
  const glow = textureMaterial(scene, "glow", "#e6a44f", (c) => {
    c.fillStyle = "#fff0a8";
    c.fillRect(8, 8, 48, 48);
    c.fillStyle = "#ffd373";
    c.fillRect(15, 15, 34, 34);
  }, 1);
  glow.emissiveColor = Color3.FromHexString("#e9933f");
  const flower = textureMaterial(scene, "flower", "#9b5675", (c, size) => {
    c.fillStyle = "#e7b3c5";
    for (let y = 4; y < size; y += 12) for (let x = 4; x < size; x += 12) c.fillRect(x, y, 5, 5);
  }, 4);
  const canvas = textureMaterial(scene, "canvas", "#a85843", (c, size) => {
    c.fillStyle = "#e0b66b";
    for (let x = 0; x < size; x += 16) c.fillRect(x, 0, 8, size);
  }, 2);
  const iron = textureMaterial(scene, "iron", "#303b42", (c, size) => {
    c.fillStyle = "#56636a";
    for (let y = 5; y < size; y += 14) c.fillRect(0, y, size, 2);
  }, 2);

  return { grass, cobble, groundCobble, masonry: masonryMaterial, dirt, water, wood, plaster, roof, leaf, darkLeaf, glow, flower, canvas, iron };
}
