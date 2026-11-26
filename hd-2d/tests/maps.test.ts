import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import { defaultSettings, validSettings } from "../src/contracts.ts";
import { bridgeSpansWaterway, mapHasRequiredStructure, maps, seeded } from "../src/maps.ts";

test("each map has connected, meaningful terrain landmarks", () => {
  assert.ok(mapHasRequiredStructure(maps.town));
  assert.ok(mapHasRequiredStructure(maps.forest));
  assert.ok(bridgeSpansWaterway(maps.town));
  assert.ok(bridgeSpansWaterway(maps.forest));

  const highestTownLevel = Math.max(...maps.town.levels.map((level) => level.height));
  assert.ok(maps.town.stairs.some((stair) => Math.abs(stair.rise - highestTownLevel) < 0.01));
  assert.ok(maps.forest.paths.some((path) => path.points.length >= 5), "forest path bends several times");
});

test("forest decoration seed stream is reproducible", () => {
  const first = seeded(maps.forest.seed);
  const second = seeded(maps.forest.seed);
  assert.deepEqual([first(), first(), first(), first()], [second(), second(), second(), second()]);
});

test("settings contract rejects non-finite and out-of-range camera values", () => {
  assert.ok(validSettings(defaultSettings));
  assert.equal(validSettings({ ...defaultSettings, zoom: 9 }), false);
  assert.equal(validSettings({ ...defaultSettings, yaw: Number.NaN }), false);
  assert.equal(validSettings({ ...defaultSettings, mapId: "moon" }), false);
});

test("distribution is standalone, CSP locked, and contains valid JavaScript", () => {
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<(?:link|img|audio|video)[^>]+(?:src|href)=/);
  assert.ok(html.length > 500_000);
  assert.ok(script);
  assert.doesNotThrow(() => new Script(script));
});
