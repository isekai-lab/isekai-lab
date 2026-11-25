import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseStory, newStory, STORY } from '../game1/src/model.ts';
import { battleTurn, newBattle } from '../game2/src/model.ts';
import { battleTurnFrames } from '../game2/src/battle-phases.ts';
import { arenaStep, arenaUpgrade, newArena } from '../game3/src/model.ts';
import { emptyArchive, makeLeaf, mergeArchives, validateArchive } from '../common/src/leaves.ts';

test('story: complete a full route using light and cloth', () => {
  let s = newStory();
  for (const choice of [0, 0, 1, 1, 0, 0, 0, 0]) s = chooseStory(s, choice);
  assert.equal(s.clear, true); assert.equal(s.ended, true); assert.equal(s.hp, 5); assert.equal(s.steps, 8);
});
test('story: death retains discoveries but not inventory on the next life', () => {
  let s = newStory();
  for (const choice of [0, 1, 0, 0]) s = chooseStory(s, choice);
  assert.equal(s.ended, true); assert.equal(s.clear, false); assert.equal(s.hp, 0);
  assert.ok(s.known.includes('青い泉の水には毒がある'));
  const next = newStory(s.known); assert.equal(next.hp, 5); assert.deepEqual(next.bag, []); assert.deepEqual(next.known, s.known);
});
test('story: missing-item choices cannot change the state', () => {
  const s = { ...newStory(), node: 'branches' }; assert.equal(chooseStory(s, 0), s); assert.equal(chooseStory(s, 99), s);
});
test('story: every displayed branch advances once when its required prop is carried', () => {
  for (const [node, story] of Object.entries(STORY)) for (let index = 0; index < story.choices.length; index++) {
    const before = { ...newStory(), node, bag: ['油', '布', '灯り'] };
    const after = chooseStory(before, index);
    assert.equal(after.steps, 1, `${node}:${index}`);
    assert.equal(after.ended, Boolean(story.choices[index].end), `${node}:${index}`);
  }
});
test('battle: wet and spark combine, and the winning hit prevents retaliation', () => {
  const initial = newBattle(), wet = battleTurn(initial, 'dew');
  assert.equal(wet.enemyHp, 17); assert.equal(wet.wet, 2);
  const spark = battleTurn(wet, 'spark'); assert.equal(spark.enemyHp, 1); assert.equal(spark.combos, 1);
  const win = battleTurn(spark, 'attack'); assert.equal(win.wave, 1); assert.equal(win.hp, 32); assert.equal(win.mp, 8);
});
test('battle: resource limits, defense and restoration', () => {
  const zero = { ...newBattle(), mp: 0 }; assert.equal(battleTurn(zero, 'spark'), zero);
  const guard = battleTurn(zero, 'guard'); assert.equal(guard.mp, 3); assert.equal(guard.hp, 31);
});
test('battle UI phases keep action, hit, and retaliation state in order', () => {
  const before = newBattle(), after = battleTurn(before, 'dew');
  const frames = battleTurnFrames(before, after, 'dew');
  assert.equal(frames.action.state.mp, 7);
  assert.equal(frames.action.state.enemyHp, 18);
  assert.equal(frames.hit.state.enemyHp, 17);
  assert.equal(frames.hit.state.hp, 32);
  assert.doesNotMatch(frames.hit.state.log.join(' '), /ダメージを受けた/);
  assert.equal(frames.counter?.state.hp, 28);
  assert.match(frames.counter?.state.log.join(' ') ?? '', /ダメージを受けた/);
});
test('battle UI defeat frame delays recovery and guard reports actual restoration', () => {
  const before = { ...newBattle(), enemyHp: 1, hp: 19, mp: 7 };
  const after = battleTurn(before, 'attack'), frames = battleTurnFrames(before, after, 'attack');
  assert.equal(frames.hit.state.wave, 0);
  assert.equal(frames.hit.state.enemyHp, 0);
  assert.equal(frames.hit.state.hp, 19);
  assert.equal(frames.hit.state.mp, 7);
  assert.equal(frames.counter, undefined);
  const guarded = battleTurn({ ...newBattle(), mp: 7 }, 'guard');
  assert.match(guarded.log[0], /魔力が1回復/);
  assert.equal(battleTurnFrames({ ...newBattle(), mp: 7 }, guarded, 'guard').action.recovery, 1);
});
test('battle: a considered strategy can clear all three encounters', () => {
  let s = newBattle();
  for (let turn = 0; turn < 100 && !s.ended; turn++) {
    const action = s.turn % 3 === 2 || s.mp < 2 ? 'guard' : s.wet > 0 ? 'spark' : 'dew';
    s = battleTurn(s, action);
  }
  assert.equal(s.ended, true); assert.equal(s.clear, true); assert.ok(s.combos >= 3);
});
test('battle: reckless attacks can lose; finished battles cannot be continued', () => {
  let s = newBattle(); for (let i = 0; i < 100 && !s.ended; i++) s = battleTurn(s, 'attack');
  assert.equal(s.ended, true); assert.equal(s.clear, false); assert.equal(battleTurn(s, 'guard'), s);
});
test('arena: point movement stays in bounds and seeds are repeatable', () => {
  const a = newArena(12), b = newArena(12); a.target = b.target = { x: 10000, y: -10000 };
  for (let i = 0; i < 300; i++) { arenaStep(a, 1 / 30); arenaStep(b, 1 / 30); }
  assert.deepEqual(a, b); assert.ok(a.player.x <= 622); assert.ok(a.player.y >= 30);
});
test('arena: growth pauses the clock and cannot grant free repeated upgrades', () => {
  const s = newArena(); s.xp = 6; arenaStep(s, .02); assert.equal(s.upgrading, true);
  const elapsed = s.elapsed; arenaStep(s, 5); assert.equal(s.elapsed, elapsed);
  arenaUpgrade(s, 'power'); assert.equal(s.power, 5); arenaUpgrade(s, 'power'); assert.equal(s.power, 5);
});
test('arena: 180 seconds clears and zero health loses', () => {
  const win = newArena(); win.elapsed = 179.99; arenaStep(win, .02); assert.equal(win.ended, true); assert.equal(win.clear, true);
  const loss = newArena(); loss.hp = 0; arenaStep(loss, .02); assert.equal(loss.ended, true); assert.equal(loss.clear, false);
});
test('arena: a complete three-minute moving run is survivable with earned upgrades', () => {
  const s = newArena(); let upgrades = 0;
  for (let i = 0; i < 14000 && !s.ended; i++) {
    if (s.upgrading) arenaUpgrade(s, s.hp < 10 ? 'heal' : upgrades++ % 2 ? 'haste' : 'power');
    const t = i / 60; s.target = { x: 320 + Math.cos(t * .6) * 100, y: 220 + Math.sin(t * .6) * 70 };
    arenaStep(s, 1 / 60);
  }
  assert.equal(s.clear, true); assert.equal(s.elapsed, 180); assert.ok(s.kills > 0); assert.ok(s.level > 1);
});
test('leaves: export roundtrip and idempotent merge keep records and discoveries', () => {
  const leaf = makeLeaf('鐘の村', '青い泉の記憶', '水には気をつけよう。', 'memory');
  const a = { ...emptyArchive(), leaves: [leaf], discoveries: ['泉の毒'] };
  const read = validateArchive(JSON.parse(JSON.stringify(a))); assert.deepEqual(read, a);
  assert.deepEqual(mergeArchives(a, read), a);
});
test('leaves: invalid and oversized imports are rejected without replacing the archive', () => {
  assert.throws(() => validateArchive({ version: 2, leaves: [], discoveries: [] }));
  const leaf = makeLeaf('a', 'b', 'c', 'memory');
  assert.throws(() => validateArchive({ version: 1, leaves: [{ ...leaf, note: 'x'.repeat(501) }], discoveries: [] }));
  assert.throws(() => validateArchive({ version: 1, leaves: [leaf, leaf], discoveries: [] }));
  assert.throws(() => validateArchive({ version: 1, leaves: [], discoveries: [42] }));
});
