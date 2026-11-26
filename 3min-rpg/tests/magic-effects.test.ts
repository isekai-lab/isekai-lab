import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { MAGIC_EFFECTS, magicEffectEmitter } from '../common/vfx/magic-effects.ts';
import { SpriteSheetDrawer } from '../common/vfx/sprite-sheet.ts';

type ManifestEffect = { id: string; duration: number; sourceURL: string; author: string; license: string; transformedHash: string; width: number; height: number; columns: number; rows: number; frameCount: number; fps: number; frameWidth: number; frameHeight: number };
const manifest = JSON.parse(readFileSync(new URL('../common/vfx/generated/magic-effects.manifest.json', import.meta.url), 'utf8')) as ManifestEffect[];

test('33 embedded CC0 sheets agree with their manifest hashes and timing', () => {
  assert.equal(manifest.length, 33);
  assert.equal(new Set(manifest.map(effect => effect.id)).size, 33);
  for (const effect of manifest) {
    const runtime = MAGIC_EFFECTS.find(candidate => candidate.id === effect.id);
    assert.ok(runtime, effect.id); const png = Buffer.from(runtime.sheet.data.split(',')[1], 'base64');
    assert.equal(createHash('sha256').update(png).digest('hex'), effect.transformedHash, effect.id);
    assert.equal(png.readUInt32BE(16), effect.width); assert.equal(png.readUInt32BE(20), effect.height);
    assert.equal(png[25], 6, `${effect.id}: RGBA PNG`); assert.equal(effect.columns * effect.rows >= effect.frameCount, true);
    assert.equal(runtime.sheet.frameWidth, effect.frameWidth); assert.equal(runtime.sheet.frameHeight, effect.frameHeight);
    assert.equal(effect.duration, effect.frameCount / effect.fps); assert.match(effect.sourceURL, /^https:\/\/opengameart\.org\//);
    assert.ok(effect.author); assert.equal(effect.license, 'CC0-1.0');
  }
});

test('sprite-sheet drawer uses elapsed time, source-grid coordinates, opacity, and a final-frame clamp', () => {
  const calls: unknown[][] = []; const context = { globalAlpha: 1, drawImage(...args: unknown[]) { calls.push(args); } } as unknown as CanvasRenderingContext2D;
  const image = { complete: true, naturalWidth: 512 } as HTMLImageElement;
  const particle = { shapeData: { data: 'data:', columns: 8, rows: 8, frameCount: 64, fps: 30, frameWidth: 64, frameHeight: 64 }, spriteSheet: { image, elapsed: 0 } };
  const drawer = new SpriteSheetDrawer();
  drawer.draw({ context, particle, radius: 32, opacity: .4, delta: { value: 500 } });
  assert.deepEqual(calls[0].slice(1), [448, 64, 64, 64, -32, -32, 64, 64]); // frame 15 in an 8×8 source grid
  assert.equal(context.globalAlpha, 1);
  drawer.draw({ context, particle, radius: 32, opacity: 1, delta: { value: 5000 } });
  assert.deepEqual(calls[1].slice(1), [448, 448, 64, 64, -32, -32, 64, 64]); // clamps at frame 63
});

test('effect emitter is a finite, self-contained stationary sprite emitter', () => {
  const effect = MAGIC_EFFECTS.find(candidate => candidate.id === 'fx3_fireBall') ?? MAGIC_EFFECTS[0];
  const emitter = magicEffectEmitter(effect, { x: 17, y: 83 });
  assert.deepEqual(emitter.position, { x: 17, y: 83 }); assert.equal(emitter.life.count, 1); assert.equal(emitter.particles.life.count, 1);
  assert.equal(emitter.particles.move.enable, false); assert.equal(emitter.particles.shape.type, 'magic-sprite-sheet');
  assert.equal(emitter.particles.shape.options['magic-sprite-sheet'].data, effect.sheet.data);
  assert.equal(emitter.particles.shape.options['magic-sprite-sheet'].frameCount, effect.sheet.frameCount);
});

test('catalog distribution is self-contained, licensed, and parseable', () => {
  const html = readFileSync(new URL('../dist/effect-catalog.html', import.meta.url), 'utf8');
  assert.match(html, /MIT License/); assert.match(html, /application:start/); assert.doesNotMatch(html, /\/Users\/|<script[^>]+src=|<link[^>]+href=/i);
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]; assert.ok(script); new vm.Script(script);
});
