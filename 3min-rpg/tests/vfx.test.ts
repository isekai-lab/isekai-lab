import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { BATTLE_VFX, BATTLE_VFX_OPTIONS, SPARK_COMBO_VFX } from '../game2/src/vfx-presets.ts';

test('game2 VFX presets cover every battle state with bounded one-shot bursts', () => {
  for (const name of ['attack', 'dew', 'spark', 'wind', 'guard', 'hit', 'counter'] as const) {
    const preset = BATTLE_VFX[name];
    assert.ok(preset.position.x >= 0 && preset.position.x <= 100, name);
    assert.ok(preset.position.y >= 0 && preset.position.y <= 100, name);
    assert.ok(preset.rate.quantity > 0 && preset.rate.quantity <= 32, name);
    assert.equal(preset.life.count, 1, name);
  }
  assert.equal(SPARK_COMBO_VFX.life.count, 1);
  assert.ok(SPARK_COMBO_VFX.rate.quantity > BATTLE_VFX.spark.rate.quantity);
});

test('tsParticles 4.6 interprets every preset colour through paint', () => {
  const source = readFileSync(new URL('../common/vendor/tsparticles-4.6.0.bundle.min.js', import.meta.url), 'utf8');
  const context: Record<string, unknown> = { console };
  context.globalThis = context; context.window = context;
  vm.runInNewContext(source, context);
  const engine = context.tsParticles as { pluginManager: unknown };
  const loadParticlesOptions = context.loadParticlesOptions as (manager: unknown, container: undefined, options: unknown) => { paint: { color: { value: unknown } } };
  for (const [name, preset] of Object.entries(BATTLE_VFX)) {
    const options = loadParticlesOptions(engine.pluginManager, undefined, preset.particles);
    assert.equal(JSON.stringify(options.paint.color.value), JSON.stringify((preset.particles.paint as { color: { value: string[] } }).color.value), name);
  }
});

test('vendored full bundle renders finite emitters when initialized like game2', async () => {
  let nextId = 0, draws = 0;
  const queue = new Map<number, (time: number) => void>();
  class Canvas {
    width: number; height: number; context: CanvasRenderingContext2D;
    constructor(width: number, height: number) {
      this.width = width; this.height = height;
      this.context = new Proxy({ canvas: this, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), getContextAttributes: () => ({}), isContextLost: () => false, createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }), measureText: () => ({ width: 10 }) }, { get: (target, key) => key in target ? target[key as keyof typeof target] : (..._args: unknown[]) => { if (['fill', 'fillRect', 'stroke', 'drawImage'].includes(String(key))) draws++; } }) as unknown as CanvasRenderingContext2D;
    }
    getContext(): CanvasRenderingContext2D { return this.context; }
    addEventListener(): void {} removeEventListener(): void {}
    getBoundingClientRect(): DOMRect { return { width: this.width, height: this.height, left: 0, top: 0 } as DOMRect; }
  }
  const context = vm.createContext({ console, setTimeout, clearTimeout, performance, document: { addEventListener() {}, removeEventListener() {}, hidden: false, querySelectorAll() { return []; } }, addEventListener() {}, removeEventListener() {}, HTMLElement: class {}, Node: class {}, OffscreenCanvas: Canvas, devicePixelRatio: 1, requestAnimationFrame: (fn: (time: number) => void) => { const id = ++nextId; queue.set(id, fn); return id; }, cancelAnimationFrame: (id: number) => queue.delete(id) });
  vm.runInContext(readFileSync(new URL('../common/vendor/tsparticles-4.6.0.bundle.min.js', import.meta.url), 'utf8'), context);
  const runtime = context as unknown as { loadFull: (engine: unknown) => Promise<void>; tsParticles: { load: (options: unknown) => Promise<{ addEmitter: (preset: unknown) => Promise<void>; destroy: () => void; particles: { count: number } }> } };
  await runtime.loadFull(runtime.tsParticles);
  const container = await runtime.tsParticles.load({ element: new Canvas(640, 288), options: { ...BATTLE_VFX_OPTIONS, autoPlay: true, pauseOnBlur: false, pauseOnOutsideViewport: false } });
  let clock = 0;
  const tick = async (count: number): Promise<void> => { for (let i = 0; i < count; i++) { clock += 17; const callbacks = [...queue.values()]; queue.clear(); for (const callback of callbacks) callback(clock); await new Promise<void>(resolve => setImmediate(resolve)); } };
  for (const [name, preset] of Object.entries({ ...BATTLE_VFX, combo: SPARK_COMBO_VFX })) {
    const before = draws; await container.addEmitter(preset); await tick(15);
    assert.ok(draws > before, `${name}: renders particles`); await tick(50);
    assert.equal(container.particles.count, 0, `${name}: expires particles`);
  }
  container.destroy();
});

test('vendored tsParticles bundle is the recorded immutable 4.6.0 browser build', () => {
  const vendor = readFileSync(new URL('../common/vendor/tsparticles-4.6.0.bundle.min.js', import.meta.url));
  assert.equal(createHash('sha256').update(vendor).digest('hex'), '6c9b0d6912ce0a80d8d41627f85adf3c9b7200485da89be1309f3cb365746291');
  assert.match(readFileSync(new URL('../common/vendor/tsparticles-4.6.0.LICENSE', import.meta.url), 'utf8'), /MIT License/);
});

test('game2 distribution contains the vendor but the other games do not', () => {
  const game2 = readFileSync(new URL('../dist/game2.html', import.meta.url), 'utf8');
  assert.match(game2, /tsParticles/); assert.match(game2, /loadFull\(tsParticles\)/); assert.match(game2, /MIT License/);
  for (const name of ['index', 'game1', 'game3']) {
    assert.doesNotMatch(readFileSync(new URL(`../dist/${name}.html`, import.meta.url), 'utf8'), /tsParticles/);
  }
});
