import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "src/index.html");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(source, resolve(dist, "index.html"), { dereference: false });
console.log("index.html · self-contained HD-2D experiment entrance");
