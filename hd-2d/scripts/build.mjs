import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const result = await build({
  entryPoints: [resolve(root, "src/main.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
  legalComments: "inline",
});

const template = await readFile(resolve(root, "src/index.html"), "utf8");
const license = await readFile(
  resolve(root, "../node_modules/@babylonjs/core/license.md"),
  "utf8",
);
// A bundled string literal must never be able to close the surrounding inline script.
const bundle = result.outputFiles[0].text.replaceAll("</script", "<\/script");
const notices = `<template id="third-party-notices">Babylon.js 9.37.2 — Apache-2.0
${license}</template>`;
const html = template
  .replace("/* BUNDLE */", () => bundle)
  .replace("</body>", `${notices}</body>`);

await writeFile(resolve(dist, "index.html"), html);
console.log("index.html · self-contained Babylon.js HD-2D maps");
