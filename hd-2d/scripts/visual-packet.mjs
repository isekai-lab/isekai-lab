import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const [captureDir, referenceDir, output, caseId] = process.argv.slice(2);
if (!captureDir || !referenceDir || !output || !caseId || process.argv.length !== 6) throw Error('usage: visual-packet.mjs CAPTURE_DIR REFERENCE_DIR OUTPUT.json CASE_ID');
const root = resolve(import.meta.dirname, '..');
const out = resolve(output), captures = resolve(captureDir);
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const refs = await read(resolve(root, 'visual-loop/references.json'));
const manifest = await read(resolve(captures, 'manifest.json'));
if (manifest.executionStatus !== 'success' || manifest.captures.length !== 6) throw Error('Capture must contain all six successful cases');
const referenceImages = [];
for (const ref of refs.images) {
  const path = resolve(referenceDir, ref.filename);
  if (sha(await readFile(path)) !== ref.sha256) throw Error(`Reference hash differs: ${ref.filename}`);
  referenceImages.push({ path: relative(dirname(out), path), role: ref.role, mapId: ref.mapId, sourceUrl: ref.sourceUrl });
}
const candidateImages = [];
const cases = new Set();
// Freeze attachment order independently of per-map retries. This is the order
// used by loop 01's original and repeated baseline judgments.
const mapOrder = ['town', 'cave', 'forest'];
const ordered = [...manifest.captures].sort((a, b) => mapOrder.indexOf(a.mapId) - mapOrder.indexOf(b.mapId) || (a.orientation === 'landscape' ? 0 : 1) - (b.orientation === 'landscape' ? 0 : 1));
for (const item of ordered) {
  const report = await read(resolve(captures, item.report));
  const key = `${item.mapId}:${item.orientation}`;
  if (cases.has(key)) throw Error('Duplicate capture case');
  cases.add(key);
  if (report.metadata.mapId !== item.mapId || report.metadata.contentId !== item.contentId || report.time.seconds !== 0) throw Error('Capture metadata mismatch');
  const conditions = { preset: report.metadata.preset, presetVersion: report.metadata.presetVersion, viewport: report.viewport, camera: report.camera, settings: report.settings, time: report.time };
  candidateImages.push({ path: relative(dirname(out), resolve(captures, item.image)), mapId: item.mapId, orientation: item.orientation, conditionId: sha(JSON.stringify(conditions)).slice(0, 16), contentId: item.contentId });
}
for (const map of ['town', 'forest', 'cave']) for (const orientation of ['landscape', 'portrait']) if (!cases.has(`${map}:${orientation}`)) throw Error('Missing capture case');
await writeFile(out, JSON.stringify({ schemaVersion: 1, caseId, referenceImages, candidateImages, rubricPath: relative(dirname(out), resolve(root, 'visual-loop/rubric-v1.md')) }, null, 2) + '\n');
console.log(JSON.stringify({ caseId, candidates: candidateImages.length, references: referenceImages.length }));
