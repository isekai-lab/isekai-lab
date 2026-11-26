import { SPRITE_SHEET_SHAPE, preloadSpriteSheet, type SpriteSheetOptions } from './sprite-sheet.ts';
import { GENERATED_MAGIC_EFFECTS } from './generated/magic-effects.ts';

export const MAGIC_EFFECTS = GENERATED_MAGIC_EFFECTS;
export type MagicEffect = (typeof MAGIC_EFFECTS)[number];

/** JSON-safe emitter options. One stationary particle plays the original sheet once. */
export function magicEffectEmitter(effect: MagicEffect, position = { x: 50, y: 50 }) {
  const sheet: SpriteSheetOptions = effect.sheet;
  return {
    position,
    rate: { quantity: 1, delay: 0.01 },
    life: { count: 1, duration: 0.025 },
    particles: {
      number: { value: 1 },
      // paint is required by tsParticles' canvas pipeline even though the PNG supplies colour.
      paint: { color: { value: '#ffffff' } },
      opacity: { value: 1 },
      shape: { type: SPRITE_SHEET_SHAPE, options: { [SPRITE_SHEET_SHAPE]: sheet } },
      size: { value: effect.size },
      life: { count: 1, duration: { value: effect.duration, sync: true } },
      move: { enable: false },
    },
  };
}

type EffectsContainer = { addEmitter?: (options: ReturnType<typeof magicEffectEmitter>) => Promise<unknown> };
export async function playMagicEffect(container: EffectsContainer, effect: MagicEffect, position?: { x: number; y: number }): Promise<void> {
  await preloadSpriteSheet(effect.sheet);
  await container.addEmitter?.(magicEffectEmitter(effect, position));
}
