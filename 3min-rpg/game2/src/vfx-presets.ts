import type { BattleAction } from './model.ts';

/** Shared with the real-engine smoke test: empty emitters activates the plugin. */
export const BATTLE_VFX_OPTIONS = {
  emitters: [], fullScreen: { enable: false }, detectRetina: false,
  fpsLimit: 60, pauseOnBlur: true,
  particles: { number: { value: 0, limit: { value: 96 } } },
};

/** Editable, responsive, one-shot battle-particle presets. */
export type BattleVfxName = BattleAction | 'hit' | 'counter';
export type BattleVfxPreset = {
  position: { x: number; y: number };
  rate: { quantity: number; delay: number };
  life: { count: number; duration: number };
  particles: Record<string, unknown>;
};

const burst = (color: string[], quantity: number, speed: { min: number; max: number }, size: { min: number; max: number }, direction = 'none'): Omit<BattleVfxPreset, 'position'> => ({
  rate: { quantity, delay: 0.01 }, life: { count: 1, duration: 0.025 },
  particles: {
    // tsParticles 4.6 reads particle colours from paint (not the legacy color key).
    paint: { color: { value: color } }, shape: { type: 'square' }, size: { value: size },
    opacity: { value: { min: 0.45, max: 0.95 }, animation: { enable: true, speed: 3, startValue: 'max', destroy: 'min' } },
    life: { count: 1, duration: { value: 0.45, sync: true } },
    move: { enable: true, direction, speed, outModes: { default: 'destroy' } },
  },
});

export const BATTLE_VFX: Record<BattleVfxName, BattleVfxPreset> = {
  attack: { position: { x: 67, y: 56 }, ...burst(['#fff3c0', '#c99557', '#795b3d'], 10, { min: 8, max: 13 }, { min: 2, max: 4 }, 'left') },
  dew: { position: { x: 66, y: 66 }, ...burst(['#bce9ed', '#6cb8df', '#effcf5'], 12, { min: 3, max: 7 }, { min: 2, max: 4 }, 'bottom') },
  spark: { position: { x: 67, y: 52 }, ...burst(['#fff8a1', '#f8e477', '#8bdcf2'], 18, { min: 7, max: 14 }, { min: 2, max: 5 }) },
  wind: { position: { x: 51, y: 55 }, ...burst(['#eff9d5', '#bddf9c', '#e9f2c2'], 11, { min: 8, max: 13 }, { min: 1, max: 3 }, 'right') },
  guard: { position: { x: 30, y: 57 }, ...burst(['#dceaaa', '#b6d47b', '#6f9d5e'], 13, { min: 3, max: 8 }, { min: 2, max: 4 }) },
  hit: { position: { x: 70, y: 53 }, ...burst(['#fff4ae', '#eaa070', '#fffdf2'], 15, { min: 6, max: 12 }, { min: 2, max: 4 }) },
  counter: { position: { x: 30, y: 61 }, ...burst(['#ffe1c2', '#eaa070', '#b75d4f'], 12, { min: 7, max: 12 }, { min: 2, max: 4 }, 'right') },
};

/** Extra bright emitter used only when spark is combined with wet. */
export const SPARK_COMBO_VFX: BattleVfxPreset = {
  position: { x: 67, y: 52 }, ...burst(['#ffffff', '#b9f5ff', '#72dfff'], 28, { min: 9, max: 16 }, { min: 2, max: 6 }),
};
