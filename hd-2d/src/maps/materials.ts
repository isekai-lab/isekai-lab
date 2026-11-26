import { Color3, DynamicTexture, Material, StandardMaterial, Texture } from "@babylonjs/core";
import type { ICanvasRenderingContext, Scene } from "@babylonjs/core";

export type MaterialName =
  | "grass" | "cobble" | "groundCobble" | "masonry" | "dirt" | "water" | "wood"
  | "plaster" | "roof" | "leaf" | "darkLeaf" | "glow" | "flower"
  | "plasterWarm" | "plasterRose" | "roofWarm" | "roofSlate" | "leafCard" | "darkLeafCard"
  | "canvas" | "iron" | "caveRock" | "caveSoil" | "moss" | "crystal";
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
  material.maxSimultaneousLights = 5;
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

function irregularPaving(context: ICanvasRenderingContext, size: number): void {
  const rows = [0, 11, 23, 36, 49, 64];
  const palette = ["#667276", "#7c8582", "#8c9189", "#59666b"];
  for (let row = 0; row < rows.length - 1; row += 1) {
    const y = rows[row] + 2;
    const height = rows[row + 1] - rows[row] - 3;
    const widths = row % 2 ? [13, 19, 11, 21] : [18, 12, 22, 12];
    let x = row % 2 ? -7 : 1;
    let index = row;
    while (x < size) {
      const width = widths[index++ % widths.length];
      context.fillStyle = palette[index % palette.length];
      context.fillRect(x + 1, y, width - 2, height);
      if (index % 3 === 0) {
        context.fillStyle = "#566267";
        context.fillRect(x + Math.max(3, width / 3), y + Math.max(2, height / 2), Math.max(3, width / 4), 2);
      }
      x += width;
    }
  }
}

function leafCardMaterial(scene: Scene, name: "leafCard" | "darkLeafCard", colors: readonly [string, string, string]): StandardMaterial {
  const texture = new DynamicTexture(`pixel-${name}`, { width: 64, height: 64 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const context = texture.getContext();
  context.clearRect(0, 0, 64, 64);
  const clusters = [[7, 18, 23, 25], [20, 7, 29, 31], [39, 16, 19, 27], [16, 34, 36, 22], [42, 37, 14, 16]] as const;
  clusters.forEach(([x, y, width, height], index) => {
    context.fillStyle = colors[index % colors.length];
    context.fillRect(x, y, width, height);
    context.clearRect(x, y, 4, 4);
    context.clearRect(x + width - 4, y + height - 4, 4, 4);
  });
  context.fillStyle = colors[2];
  for (const [x, y] of [[12, 25], [29, 12], [47, 24], [25, 45], [45, 43]] as const) context.fillRect(x, y, 5, 4);
  texture.hasAlpha = true;
  texture.update(false);
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
  material.specularColor = Color3.Black();
  material.maxSimultaneousLights = 5;
  return material;
}

export function createWorldMaterials(scene: Scene): WorldMaterials {
  const grass = textureMaterial(scene, "grass", "#315944", (c) => {
    c.fillStyle = "#42684a";
    for (const [x, y, width, height] of [[4, 7, 13, 7], [25, 3, 19, 10], [48, 12, 11, 15], [8, 29, 20, 12], [36, 31, 22, 9], [2, 50, 16, 9], [25, 47, 25, 13]] as const) c.fillRect(x, y, width, height);
    c.fillStyle = "#244438";
    for (const [x, y] of [[14, 10], [31, 8], [53, 19], [20, 37], [43, 34], [9, 55], [39, 53]] as const) c.fillRect(x, y, 5, 3);
  }, 5);
  const cobble = textureMaterial(scene, "cobble", "#48565a", (c, size) => irregularPaving(c, size), 4);
  const groundCobble = textureMaterial(scene, "groundCobble", "#48565a", (c, size) => irregularPaving(c, size), 8);
  const masonryMaterial = textureMaterial(scene, "masonry", "#6a7475", (c, size) => {
    masonry(c, size, "#3f4b50", "#89918d");
  }, 3);
  const dirt = textureMaterial(scene, "dirt", "#79583e", (c, size) => {
    c.fillStyle = "#9b7450";
    for (let y = 3; y < size; y += 9) for (let x = (y * 2) % 12; x < size; x += 15) c.fillRect(x, y, 4, 2);
    c.fillStyle = "#503d31";
    for (let y = 8; y < size; y += 16) c.fillRect((y * 7) % size, y, 3, 3);
  }, 3);
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
  const plasterWarm = textureMaterial(scene, "plasterWarm", "#d9bd8f", (c, size) => {
    c.fillStyle = "#b89068";
    for (let y = 7; y < size; y += 17) c.fillRect((y * 3) % 51, y, 9, 3);
  }, 2);
  const plasterRose = textureMaterial(scene, "plasterRose", "#cda58d", (c, size) => {
    c.fillStyle = "#a97968";
    for (let y = 5; y < size; y += 19) c.fillRect((y * 5) % 53, y, 8, 3);
  }, 2);
  const roofWarm = textureMaterial(scene, "roofWarm", "#8a4939", (c, size) => {
    c.fillStyle = "#b56548";
    for (let y = 0; y < size; y += 9) { c.fillRect(0, y, size, 2); for (let x = (y % 18) / 2; x < size; x += 12) c.fillRect(x, y, 2, 9); }
  }, 3);
  const roofSlate = textureMaterial(scene, "roofSlate", "#465b5a", (c, size) => {
    c.fillStyle = "#718078";
    for (let y = 0; y < size; y += 10) { c.fillRect(0, y, size, 2); for (let x = (y / 2) % 11; x < size; x += 13) c.fillRect(x, y, 2, 10); }
  }, 3);
  const leafPainter = (light: string, dark: string): Painter => (c, size) => {
    c.fillStyle = light;
    for (let y = 3; y < size; y += 8) for (let x = (y * 3) % 10; x < size; x += 13) c.fillRect(x, y, 4, 3);
    c.fillStyle = dark;
    for (let y = 6; y < size; y += 13) c.fillRect((y * 7) % size, y, 5, 4);
  };
  const leaf = textureMaterial(scene, "leaf", "#245c42", leafPainter("#43805a", "#163d31"), 4);
  const darkLeaf = textureMaterial(scene, "darkLeaf", "#1c493b", leafPainter("#346b4d", "#102f2a"), 4);
  const leafCard = leafCardMaterial(scene, "leafCard", ["#2e6a49", "#43805a", "#1b4b39"]);
  const darkLeafCard = leafCardMaterial(scene, "darkLeafCard", ["#1b4938", "#2d6246", "#12362d"]);
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
  const caveRock = textureMaterial(scene, "caveRock", "#38404b", (c) => {
    c.fillStyle = "#4b5260";
    for (const [x, y, width, height] of [[2, 6, 22, 11], [27, 3, 31, 14], [8, 24, 34, 13], [45, 22, 16, 20], [1, 44, 25, 15], [29, 42, 31, 17]] as const) c.fillRect(x, y, width, height);
    c.fillStyle = "#626674";
    for (const [x, y, width] of [[8, 9, 12], [34, 7, 18], [15, 28, 20], [48, 27, 9], [6, 49, 15], [35, 47, 18]] as const) c.fillRect(x, y, width, 3);
    c.fillStyle = "#242b37";
    c.fillRect(22, 17, 5, 8); c.fillRect(42, 35, 6, 9); c.fillRect(24, 55, 5, 7);
  }, 4);
  const caveSoil = textureMaterial(scene, "caveSoil", "#4b3d42", (c, size) => {
    c.fillStyle = "#6d554d";
    for (let y = 4; y < size; y += 11) c.fillRect((y * 7) % size, y, 7, 2);
    c.fillStyle = "#2d303a";
    for (let x = 7; x < size; x += 17) c.fillRect(x, (x * 3) % size, 3, 4);
  }, 5);
  const moss = textureMaterial(scene, "moss", "#28463b", leafPainter("#4f7051", "#18342e"), 5);
  const crystal = textureMaterial(scene, "crystal", "#577ca2", (c) => {
    c.fillStyle = "#a7dded"; c.fillRect(21, 4, 10, 48); c.fillRect(8, 22, 12, 31); c.fillRect(40, 15, 11, 38);
    c.fillStyle = "#d8ffff"; c.fillRect(24, 8, 4, 39); c.fillRect(11, 26, 4, 21);
  }, 1);
  crystal.emissiveColor = Color3.FromHexString("#3b7195");

  return { grass, cobble, groundCobble, masonry: masonryMaterial, dirt, water, wood, plaster, roof, plasterWarm, plasterRose, roofWarm, roofSlate, leaf, darkLeaf, leafCard, darkLeafCard, glow, flower, canvas, iron, caveRock, caveSoil, moss, crystal };
}
