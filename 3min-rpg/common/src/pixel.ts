import { PALETTE, SPRITES } from '../assets/sprites.ts';
export function sprite(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size = 3, flip = false): void {
  const pixels = SPRITES[name] ?? SPRITES.slime;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (flip) { ctx.translate(16 * size, 0); ctx.scale(-1, 1); }
  for (let j = 0; j < pixels.length; j++) for (let i = 0; i < pixels[j].length; i++) {
    const color = PALETTE[pixels[j][i]];
    if (color) { ctx.fillStyle = color; ctx.fillRect(i * size, j * size, size, size); }
  }
  ctx.restore();
}
export function forest(ctx: CanvasRenderingContext2D, width = 640, height = 288): void {
  ctx.fillStyle = '#a9c5b0'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#c8d8b0'; ctx.fillRect(0, height * .48, width, height * .52);
  ctx.fillStyle = '#d9d5ae'; ctx.fillRect(0, height * .72, width, 48);
  for (let i = 0; i < 46; i++) {
    const x = (i * 137 + 19) % width, y = height * .53 + (i * 47) % (height * .45);
    ctx.fillStyle = i % 3 ? '#a4bd8e' : '#e8dca8'; ctx.fillRect(x, y, 4, 3);
  }
  [8, 83, 470, 552].forEach((x, i) => sprite(ctx, 'tree', x, 12 + i % 2 * 28, 5));
  ctx.fillStyle = '#fcf0be35';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i * 140, 0); ctx.lineTo(i * 140 + 80, height); ctx.lineTo(i * 140 + 125, height); ctx.lineTo(i * 140 + 18, 0); ctx.fill(); }
}
export function vignette(canvas: HTMLCanvasElement, foe: string = 'slime', stage = 0): void {
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  forest(ctx); sprite(ctx, 'shrine', 283, 77, 5);
  sprite(ctx, 'hero', 157, 185, 4); sprite(ctx, foe, 418, 180, 4, true);
  ctx.fillStyle = '#fcf5de'; ctx.font = '12px monospace'; ctx.fillText(['木漏れ日の入口', '小さな冒険の途中', '世界樹の木陰'][Math.min(stage, 2)], 24, 268);
}
