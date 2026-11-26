import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { Script } from "node:vm";
import test from "node:test";
import { defaultSettings, validSettings } from "../src/contracts/index.ts";
import { abortBenchmark, beginBenchmark, benchmarkPercentiles, captureBenchmark, markBenchmarkReady } from "../src/common/benchmark.ts";
import { normalizeSettings } from "../src/common/settings.ts";
import { createWalkCourse } from "../src/fixtures/walk-course.ts";
import { bridgeSpansWaterway, mapHasRequiredStructure, maps, seeded } from "../src/maps/definitions.ts";
import { createMapWalkSurface } from "../src/maps/walk.ts";

const root = new URL("..", import.meta.url).pathname;
const build = (...args: string[]) => execFileSync(process.execPath, ["scripts/build.mjs", ...args], { cwd: root, encoding: "utf8" });

test("all three maps retain meaningful deterministic structure", () => {
  for (const map of Object.values(maps)) assert.ok(bridgeSpansWaterway(map), map.id);
  for (const map of Object.values(maps)) assert.ok(mapHasRequiredStructure(map), `${map.id} structure`);
  const first = seeded(maps.forest.seed); const second = seeded(maps.forest.seed);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test("walk course distinguishes road, stairs, platform, bridge, water, and obstacle", () => {
  const walk = createWalkCourse();
  assert.equal(new Set(walk.surfaceIds).size, walk.surfaceIds.length);
  assert.equal(walk.sample(-1, 0)?.surfaceId, "course:bridge");
  assert.equal(walk.sample(-1, 1)?.surfaceId, undefined, "water outside bridge is impassable");
  assert.equal(walk.sample(2, -1.9, "course:road")?.height, .5);
  assert.equal(walk.sample(2, 1.9, "course:stairs")?.surfaceId, "course:stairs");
  assert.equal(walk.sample(3, 3, "course:stairs")?.surfaceId, "course:platform");
  assert.ok(walk.obstacles.some((obstacle) => obstacle.id === "course:pillar"));
  for (const connection of walk.connections) {
    assert.ok(walk.surfaceIds.includes(connection.from));
    assert.ok(walk.surfaceIds.includes(connection.to));
  }
});

test("map query blocks water, returns valid fixed spawn, and only links real surfaces", () => {
  const walk = createMapWalkSurface(maps.town);
  assert.equal(walk.sample(0, -10), undefined);
  assert.equal(walk.sample(0, .2)?.surfaceId, "town:bridge:0");
  assert.equal(walk.heightAt(walk.spawn.x, walk.spawn.z, walk.spawn.surfaceId), walk.spawn.y);
  for (const edge of walk.connections) assert.ok(walk.surfaceIds.includes(edge.from) && walk.surfaceIds.includes(edge.to));
});

test("settings reject NaN, unknown maps, partial and malformed JSON", () => {
  assert.ok(validSettings(defaultSettings));
  assert.equal(normalizeSettings({ ...defaultSettings, yaw: Number.NaN }), undefined);
  assert.equal(normalizeSettings({ ...defaultSettings, mapId: "moon" }), undefined);
  assert.equal(normalizeSettings({ mapId: "town" }), undefined);
  assert.throws(() => JSON.parse("{bad"));
});

test("benchmark waits for readiness, separates samples, and aborts mixed conditions", () => {
  const state = beginBenchmark("fixed");
  captureBenchmark(state, { conditionKey: "fixed", now: 9_000, intervalMs: 99, cpuSceneRenderMs: 99 });
  assert.equal(state.intervals.length, 0);
  markBenchmarkReady(state, 10_000);
  captureBenchmark(state, { conditionKey: "fixed", now: 12_000, intervalMs: 50, cpuSceneRenderMs: 5 });
  captureBenchmark(state, { conditionKey: "fixed", now: 12_020, intervalMs: 20, cpuSceneRenderMs: 3 });
  captureBenchmark(state, { conditionKey: "fixed", now: 22_001, intervalMs: 18, cpuSceneRenderMs: 2 });
  assert.deepEqual(benchmarkPercentiles(state), { sampleCount: 1, frameIntervalMs: { p50: 20, p95: 20 }, cpuSceneRenderMs: { p50: 3, p95: 3 } });
  const changed = beginBenchmark("a"); markBenchmarkReady(changed, 0);
  captureBenchmark(changed, { conditionKey: "b", now: 3_000, intervalMs: 1, cpuSceneRenderMs: 1 });
  assert.equal(changed.phase, "aborted"); assert.equal(benchmarkPercentiles(changed), undefined);
  abortBenchmark(state, "late"); assert.equal(state.phase, "complete");
});

test("build validates flags, refuses contention, and selected page preserves others", () => {
  build();
  const beforeMaps = readFileSync(new URL("../dist/maps.html", import.meta.url));
  const beforeCharacters = readFileSync(new URL("../dist/characters.html", import.meta.url));
  build("--page", "index");
  assert.deepEqual(readFileSync(new URL("../dist/maps.html", import.meta.url)), beforeMaps);
  assert.deepEqual(readFileSync(new URL("../dist/characters.html", import.meta.url)), beforeCharacters);
  assert.notEqual(spawnSync(process.execPath, ["scripts/build.mjs", "wrong"], { cwd: root }).status, 0);
  const lock = new URL("../.build.lock", import.meta.url); mkdirSync(lock);
  try { assert.notEqual(spawnSync(process.execPath, ["scripts/build.mjs"], { cwd: root }).status, 0); }
  finally { rmSync(lock, { recursive: true }); }
});

test("all standalone pages are offline and contain parseable inline JavaScript", () => {
  build();
  for (const page of ["index", "maps", "characters"]) {
    const html = readFileSync(new URL(`../dist/${page}.html`, import.meta.url), "utf8");
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
    assert.match(html, /connect-src 'none'/); assert.doesNotMatch(html, /<script[^>]+src=/); assert.ok(html.length > 500_000); assert.ok(script); assert.doesNotThrow(() => new Script(script));
    assert.match(html, /Babylon\.js 9\.37\.2/);
    const declaredBytes = Number(html.match(/data-html-bytes="(\d+)"/)?.[1]);
    assert.equal(declaredBytes, Buffer.byteLength(html, "utf8"));
  }
});
