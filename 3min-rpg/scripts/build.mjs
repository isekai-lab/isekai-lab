import { readFile, mkdir, writeFile } from 'node:fs/promises';
import * as nodeModule from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (Number(process.versions.node.split('.')[0]) < 24 || typeof nodeModule.stripTypeScriptTypes !== 'function') {
  console.error(`ビルドにはNode.js 24以上が必要です（現在 ${process.version}）。\n生成済みHTMLを配信するだけなら、HOST=0.0.0.0 PORT=4174 npm run preview を実行してください。`);
  process.exit(1);
}
const { stripTypeScriptTypes } = nodeModule;
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const theme = await readFile(path.join(root, 'common/src/theme.css'), 'utf8');
const tsParticles = await readFile(path.join(root, 'common/vendor/tsparticles-4.6.0.bundle.min.js'), 'utf8');
const tsParticlesLicense = await readFile(path.join(root, 'common/vendor/tsparticles-4.6.0.LICENSE'), 'utf8');
const targets = { 'index.html': 'common/src/gallery.ts', 'game1.html': 'game1/src/main.ts', 'game2.html': 'game2/src/main.ts', 'game3.html': 'game3/src/main.ts' };
// Tiny dependency-free packer for this prototype's named-import-only modules.
// TypeScript erasure is performed by Node itself. Upgrade to esbuild/Vite when needed.
async function bundle(entry) {
  const visited = new Set(), pieces = [];
  async function visit(filename) {
    if (visited.has(filename)) return; visited.add(filename);
    let source = stripTypeScriptTypes(await readFile(filename, 'utf8'), { mode: 'strip' });
    const pattern = /^import\s+.+?\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
    const imports = [...source.matchAll(pattern)];
    for (const match of imports) {
      if (!match[1].startsWith('.')) throw new Error(`External import is not supported: ${match[1]}`);
      await visit(path.resolve(path.dirname(filename), match[1]));
    }
    source = source.replace(pattern, '').replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\b)/gm, '');
    if (/^\s*(?:import|export)\s/m.test(source)) throw new Error(`Unsupported module syntax: ${filename}`);
    pieces.push(`// ${path.relative(root, filename)}\n${source}`);
  }
  await visit(path.join(root, entry));
  return `(()=>{\n'use strict';\n${pieces.join('\n')}\n})();`;
}
await mkdir(dist, { recursive: true });
for (const [name, entry] of Object.entries(targets)) {
  const application = await bundle(entry);
  // The full bundle provides emitters; it is deliberately inlined only into game2.
  const vendor = name === 'game2.html' ? `/*\n${tsParticlesLicense}\n*/\n${tsParticles}\n` : '';
  const js = `${vendor}/* application:start */\n${application}`.replace(/<\/script/gi, '\\x3c/script');
  const document = `<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'"><meta name="theme-color" content="#eef0e4"><title>転生魔法研究所</title><style>${theme}</style></head><body><noscript>このゲームを遊ぶにはJavaScriptを有効にしてください。</noscript><script>${js}</script></body></html>`;
  await writeFile(path.join(dist, name), document);
  console.log(`${name.padEnd(12)} ${(Buffer.byteLength(document) / 1024).toFixed(1)} KiB · self-contained`);
}
