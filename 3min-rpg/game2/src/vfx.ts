import { BATTLE_VFX, BATTLE_VFX_OPTIONS, SPARK_COMBO_VFX } from './vfx-presets.ts';
import type { BattleVfxName, BattleVfxPreset } from './vfx-presets.ts';

type TsParticlesContainer = { addEmitter?: (options: BattleVfxPreset) => Promise<unknown>; destroy: () => void };
declare const tsParticles: { load: (options: Record<string, unknown>) => Promise<TsParticlesContainer> };
declare const loadFull: (engine: unknown) => Promise<void>;

/** One transparent tsParticles canvas above the existing Canvas2D battle scene. */
export class BattleVfx {
  private container: TsParticlesContainer | null = null;
  private pending: Array<{ name: BattleVfxName; combo: boolean }> = [];
  private disposed = false;
  private failed = false;
  constructor(host: HTMLDivElement) {
    void this.start(host);
    // A bfcache page keeps its canvas and RAF state; destroying it would make
    // effects disappear when the user navigates back to this battle.
    window.addEventListener('pagehide', (event) => { if (!event.persisted) this.dispose(); });
  }
  play(name: BattleVfxName, combo = false): void {
    if (this.disposed || this.failed || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!this.container) { if (this.pending.length < 12) this.pending.push({ name, combo }); return; }
    void this.emit(BATTLE_VFX[name]); if (combo) void this.emit(SPARK_COMBO_VFX);
  }
  dispose(): void { this.disposed = true; this.container?.destroy(); this.container = null; this.pending = []; }
  private async start(host: HTMLDivElement): Promise<void> {
    try {
      await loadFull(tsParticles);
      // An empty emitter list activates the full bundle's emitter plugin; the
      // turn-specific emitters are then added through addEmitter below.
      const loaded = await tsParticles.load({ id: host.id, options: BATTLE_VFX_OPTIONS });
      if (this.disposed) { loaded.destroy(); return; }
      this.container = loaded;
      for (const effect of this.pending) this.play(effect.name, effect.combo); this.pending = [];
    } catch { this.failed = !this.disposed; this.pending = []; }
  }
  private async emit(preset: BattleVfxPreset): Promise<void> { await this.container?.addEmitter?.(preset); }
}
