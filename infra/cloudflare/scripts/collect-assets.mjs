import { lstat, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { basename, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const defaultSources = [
  { directory: resolve(repositoryRoot, "3min-rpg/dist"), target: "." },
  { directory: resolve(repositoryRoot, "hd-2d/dist"), target: "hd-2d" },
];
const defaultOutput = resolve(repositoryRoot, "infra/cloudflare/.generated/assets");

async function requiredRegularFile(path, label) {
  let status;
  try { status = await lstat(path); } catch { throw new Error(`${label} is missing: ${path}`); }
  if (status.isSymbolicLink() || !status.isFile()) throw new Error(`${label} must be a regular file: ${path}`);
}

export async function collectAssets({ sources = defaultSources, output = defaultOutput } = {}) {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true, mode: 0o700 });
  for (const { directory, target } of sources) {
    await requiredRegularFile(resolve(directory, "index.html"), "Required index.html");
    const entries = await readdir(directory, { withFileTypes: true });
    const targetDirectory = resolve(output, target);
    await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
    for (const entry of entries) {
      const source = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link in asset source: ${source}`);
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      await writeFile(resolve(targetDirectory, basename(entry.name)), await readFile(source));
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await collectAssets();
  console.log("Collected HTML-only private Worker assets.");
}
