import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { collectAssets } from "./collect-assets.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tensei-assets-test-"));
  const game = join(root, "game");
  const hd2d = join(root, "hd2d");
  const output = join(root, "output");
  return { root, game, hd2d, output };
}
function write(path, body = "<!doctype html>") { writeFileSync(path, body); }

test("keeps root HTML and places only HD-2D HTML under /hd-2d/", async () => {
  const paths = fixture();
  try {
    await (await import("node:fs/promises")).mkdir(paths.game);
    await (await import("node:fs/promises")).mkdir(paths.hd2d);
    write(join(paths.game, "index.html"), "game index"); write(join(paths.game, "game1.html")); write(join(paths.game, "secret.env"), "never copy");
    write(join(paths.hd2d, "index.html"), "hd index"); write(join(paths.hd2d, "notes.txt"), "never copy");
    await collectAssets({ output: paths.output, sources: [{ directory: paths.game, target: "." }, { directory: paths.hd2d, target: "hd-2d" }] });
    assert.equal(readFileSync(join(paths.output, "index.html"), "utf8"), "game index");
    assert.equal(readFileSync(join(paths.output, "hd-2d/index.html"), "utf8"), "hd index");
    await assert.rejects(() => import("node:fs/promises").then(({ access }) => access(join(paths.output, "secret.env"))));
    await assert.rejects(() => import("node:fs/promises").then(({ access }) => access(join(paths.output, "hd-2d/notes.txt"))));
  } finally { rmSync(paths.root, { recursive: true, force: true }); }
});

test("cleans stale files and rejects missing indexes or symlinks", async () => {
  const paths = fixture();
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(paths.game); await fs.mkdir(paths.hd2d); await fs.mkdir(paths.output, { recursive: true });
    write(join(paths.output, "stale.html")); write(join(paths.game, "index.html")); write(join(paths.hd2d, "index.html"));
    await collectAssets({ output: paths.output, sources: [{ directory: paths.game, target: "." }, { directory: paths.hd2d, target: "hd-2d" }] });
    await assert.rejects(() => fs.access(join(paths.output, "stale.html")));
    await fs.rm(join(paths.hd2d, "index.html"));
    await assert.rejects(() => collectAssets({ output: paths.output, sources: [{ directory: paths.game, target: "." }, { directory: paths.hd2d, target: "hd-2d" }] }), /Required index\.html is missing/);
    write(join(paths.hd2d, "index.html"));
    symlinkSync(join(paths.game, "index.html"), join(paths.game, "linked.html"));
    await assert.rejects(() => collectAssets({ output: paths.output, sources: [{ directory: paths.game, target: "." }, { directory: paths.hd2d, target: "hd-2d" }] }), /Refusing symbolic link/);
  } finally { rmSync(paths.root, { recursive: true, force: true }); }
});
