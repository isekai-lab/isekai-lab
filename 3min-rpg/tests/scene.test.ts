import test from 'node:test';
import assert from 'node:assert/strict';
import { StoryScene, sceneRoute } from '../game1/src/scene.ts';
import { STORY } from '../game1/src/model.ts';
import { PALETTE } from '../common/assets/sprites.ts';
import { GAME_SPRITES } from '../game1/assets/sprites.ts';

type Listener = () => void;
function sceneHarness(reduced: boolean) {
  const queued: Array<(time: number) => void> = [], listeners = new Map<string, Listener>();
  const calls: string[] = [];
  const ctx = {
    imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', globalAlpha: 1,
    clearRect: (...a: number[]) => calls.push(`clear:${a}`), fillRect: (...a: number[]) => calls.push(`rect:${a}`),
    beginPath: () => calls.push('begin'), ellipse: (...a: number[]) => calls.push(`ellipse:${a}`), arc: (...a: number[]) => calls.push(`arc:${a}`),
    fill: () => calls.push('fill'), stroke: () => calls.push('stroke'), moveTo: (...a: number[]) => calls.push(`move:${a}`),
    lineTo: (...a: number[]) => calls.push(`line:${a}`), quadraticCurveTo: (...a: number[]) => calls.push(`curve:${a}`),
    save: () => calls.push('save'), restore: () => calls.push('restore'), translate: (...a: number[]) => calls.push(`translate:${a}`),
    scale: (...a: number[]) => calls.push(`scale:${a}`), rotate: (...a: number[]) => calls.push(`rotate:${a}`), fillText: (s: string, ...a: number[]) => calls.push(`text:${s}:${a}`)
  };
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = { document: globals.document, requestAnimationFrame: globals.requestAnimationFrame, cancelAnimationFrame: globals.cancelAnimationFrame, matchMedia: globals.matchMedia };
  const doc = { hidden: false, addEventListener: (name: string, fn: Listener) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) };
  globals.document = doc; globals.matchMedia = () => ({ matches: reduced }); globals.requestAnimationFrame = (fn: (time: number) => void) => (queued.push(fn), queued.length); globals.cancelAnimationFrame = () => undefined;
  return { canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement, calls, queued, doc, listeners, restore: () => Object.assign(globals, previous) };
}

test('scene routes reach props and distinguish bridge boards from the ford', () => {
  const route = (node: string, index: number, progress: number) => sceneRoute({ node, index, choice: STORY[node].choices[index] }, progress);
  assert.equal(route('traveler', 0, 1).x, 430);
  assert.ok(route('bell', 0, 1).x >= 440, 'the hero reaches the bell tower before wrapping it');
  assert.equal(route('bridge', 0, .28).y, 165);
  assert.equal(route('bridge', 1, .28).y, 238);
  assert.ok(route('pond', 1, 1).x > 550);
});

test('game-one sprites use palette rows, large scene originals, and two butterfly frames', () => {
  for (const [name, rows] of Object.entries(GAME_SPRITES)) {
    assert.ok(rows.length > 0 && rows[0].length > 0, name);
    for (const row of rows) {
      assert.equal(row.length, rows[0].length, `${name} has a rectangular pixel grid`);
      for (const pixel of row) assert.ok(pixel in PALETTE, `${name} uses shared palette`);
    }
  }
  assert.equal(GAME_SPRITES.hutLarge.length, 32); assert.equal(GAME_SPRITES.hutLarge[0].length, 40);
  assert.equal(GAME_SPRITES.libraryLarge.length, 32); assert.equal(GAME_SPRITES.libraryLarge[0].length, 44);
  assert.equal(GAME_SPRITES.pondLarge.length, 24); assert.equal(GAME_SPRITES.pondLarge[0].length, 56);
  assert.equal(GAME_SPRITES.bellLarge.length, 40); assert.equal(GAME_SPRITES.bellLarge[0].length, 24);
  assert.notDeepEqual(GAME_SPRITES.butterflyA, GAME_SPRITES.butterflyB);
  assert.ok(GAME_SPRITES.butterflyA.some(row => row.includes('o')));
  assert.ok(GAME_SPRITES.butterflyA.some(row => row.includes('p') && row.includes('y')));
});

test('scene locks an action, aborts it while hidden, and reduced idle frames are static', () => {
  const h = sceneHarness(true);
  try {
    const notes: string[] = [], scene = new StoryScene(h.canvas, note => notes.push(note));
    scene.setNode('start');
    h.queued.shift()!(100); const first = h.calls.join('|'); h.calls.length = 0;
    h.queued.shift()!(900); assert.equal(h.calls.join('|'), first, 'reduced motion must not bob the hero or move insects');
    let done = 0, aborted = 0;
    scene.play({ node: 'bridge', index: 0, choice: STORY.bridge.choices[0] }, () => done++, () => aborted++);
    scene.play({ node: 'bridge', index: 1, choice: STORY.bridge.choices[1] }, () => done++, () => aborted++);
    assert.equal(scene.isBusy(), true);
    h.doc.hidden = true; h.listeners.get('visibilitychange')!();
    assert.equal(aborted, 1); assert.equal(done, 0); assert.equal(scene.isBusy(), false);
    h.queued.shift()!(5000); assert.equal(done, 0, 'an old queued frame must not apply an aborted choice');
    scene.finishOutcome(false, true); assert.match(notes.at(-1)!, /森の入口/);
    h.calls.length = 0; h.queued.shift()!(5100);
    assert.match(h.calls.join('|'), /text:森の入口:/, 'failed run redraws the forest entrance label');
    scene.dispose(); assert.equal(h.listeners.has('visibilitychange'), false);
  } finally { h.restore(); }
});

test('both failure kinds return the standing hero to the forest, while success retains the bell scene', () => {
  const h = sceneHarness(true);
  try {
    const notes: string[] = [], scene = new StoryScene(h.canvas, note => notes.push(note));
    scene.setNode('bell'); scene.finishOutcome(false, false);
    h.queued.shift()!(100); assert.match(h.calls.join('|'), /text:森の入口:/);
    assert.match(notes.at(-1)!, /記憶は残っている/);
    h.calls.length = 0; scene.setNode('bell'); scene.finishOutcome(true, false);
    h.queued.shift()!(200); assert.match(h.calls.join('|'), /text:鐘楼:/);
    scene.dispose();
  } finally { h.restore(); }
});
