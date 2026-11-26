import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const lock = resolve(root, ".build.lock");
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--page" || !["index", "maps", "characters"].includes(args[1]))) {
  throw new Error("usage: build.mjs [--page index|maps|characters]");
}
const pages = args.length ? [args[1]] : ["index", "maps", "characters"];
const stage = resolve(root, `.stage-${process.pid}-${Date.now()}`);
let ownsLock = false;
try {
  await mkdir(lock);
  ownsLock = true;
  await mkdir(stage);
  const template = await readFile(resolve(root, "src/common/template.html"), "utf8");
  const license = await readFile(resolve(root, "../node_modules/@babylonjs/core/license.md"), "utf8");
  for (const page of pages) {
    const result = await build({
      entryPoints: [resolve(root, "src/entries", `${page}.ts`)],
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2022",
      minify: true,
      write: false,
      legalComments: "inline",
    });
    const bundle = result.outputFiles[0].text.replace(/<\/script/gi, (match) => `<\\/${match.slice(2)}`);
    const buildId = createHash("sha256").update(bundle).digest("hex").slice(0, 16);
    const notices = `<template id="third-party-notices" data-build-id="${buildId}" data-html-bytes="0000000000000000">Babylon.js 9.37.2 — Apache-2.0\n${license}</template>`;
    const provisional = template.replace("/* BUNDLE */", () => bundle).replace("</body>", () => `${notices}\n</body>`);
    const byteLength = Buffer.byteLength(provisional, "utf8");
    const html = provisional.replace(
      'data-html-bytes="0000000000000000"',
      () => `data-html-bytes="${String(byteLength).padStart(16, "0")}"`,
    );
    await writeFile(resolve(stage, `${page}.html`), html);
  }
  await mkdir(dist, { recursive: true });
  for (const page of pages) await rename(resolve(stage, `${page}.html`), resolve(dist, `${page}.html`));
  console.log(`${pages.join(", ")} · standalone HD-2D pages`);
} finally {
  await rm(stage, { recursive: true, force: true });
  if (ownsLock) await rm(lock, { recursive: true, force: true });
}
