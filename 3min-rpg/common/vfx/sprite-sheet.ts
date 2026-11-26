/**
 * tsParticles has image shapes, but not sprite-sheet animation.  This drawer
 * deliberately advances from `delta.value` (milliseconds), rather than from
 * draw calls, so a slow display does not speed up the source animation.
 */
export type SpriteSheetOptions = {
  data: string;
  columns: number;
  rows: number;
  frameCount: number;
  fps: number;
  frameWidth: number;
  frameHeight: number;
};

type SpriteParticle = {
  shapeData?: SpriteSheetOptions;
  spriteSheet?: { image: HTMLImageElement; elapsed: number };
};
type ShapeDrawData = {
  context: CanvasRenderingContext2D;
  particle: SpriteParticle;
  radius: number;
  opacity: number;
  delta: { value: number };
};
type ShapeEngine = { pluginManager: { addShape: (names: string[], drawer: () => Promise<SpriteSheetDrawer>) => void } };
const images = new Map<string, Promise<HTMLImageElement>>();

/** Decodes a local data URI once. Call before emitting so the first frame is never skipped. */
export function preloadSpriteSheet(sheet: SpriteSheetOptions): Promise<HTMLImageElement> {
  let pending = images.get(sheet.data);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Magic sprite sheet could not be decoded'));
      image.src = sheet.data;
    });
    images.set(sheet.data, pending);
  }
  return pending;
}

export const SPRITE_SHEET_SHAPE = 'magic-sprite-sheet';

export class SpriteSheetDrawer {
  draw(data: ShapeDrawData): void {
    const state = data.particle.spriteSheet;
    const sheet = data.particle.shapeData;
    if (!state || !sheet || !state.image.complete || !state.image.naturalWidth) return;
    state.elapsed += Math.max(0, data.delta.value);
    const frame = Math.min(sheet.frameCount - 1, Math.floor(state.elapsed * sheet.fps / 1000));
    const column = frame % sheet.columns;
    const row = Math.floor(frame / sheet.columns);
    const diameter = data.radius * 2;
    data.context.globalAlpha = data.opacity;
    data.context.drawImage(state.image, column * sheet.frameWidth, row * sheet.frameHeight,
      sheet.frameWidth, sheet.frameHeight, -data.radius, -data.radius, diameter, diameter);
    data.context.globalAlpha = 1;
  }
  getSidesCount(): number { return 4; }
  particleInit(_container: unknown, particle: SpriteParticle): void {
    const data = particle.shapeData;
    if (!data) return;
    const image = new Image();
    image.src = data.data;
    particle.spriteSheet = { image, elapsed: 0 };
    void preloadSpriteSheet(data).then(loaded => { if (particle.spriteSheet) particle.spriteSheet.image = loaded; });
  }
  particleDestroy(particle: SpriteParticle): void { delete particle.spriteSheet; }
}

/** Register before calling `loadFull`/`tsParticles.load`; the engine locks registrations after initialization. */
export function installSpriteSheetShape(engine: ShapeEngine): void {
  engine.pluginManager.addShape([SPRITE_SHEET_SHAPE], () => Promise.resolve(new SpriteSheetDrawer()));
}
