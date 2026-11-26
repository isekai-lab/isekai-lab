import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const keys = ['compositionDepth', 'materialPixels', 'lightingContact', 'routeReadability', 'sceneIdentity'];
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const total = scores => keys.reduce((sum, key) => sum + scores[key] * 5, 0);

// Run after both packets passed visual-evaluate validation. Conditions belong to
// the capture protocol, not to the reviewer; reviewers never calculate totals.
export function compare(before, after, beforeManifest, afterManifest) {
  if (beforeManifest.rubricSha256 !== afterManifest.rubricSha256) throw Error('Rubric changed; scores are not comparable');
  const refs = m => m.attachments.filter(x => x.kind === 'reference').map(x => [x.label, x.sha256]);
  if (JSON.stringify(refs(beforeManifest)) !== JSON.stringify(refs(afterManifest))) throw Error('Reference anchors changed');
  const findAttachment = (m, j) => m.attachments.find(x => x.label === j.imageLabel && x.kind === 'candidate');
  if (before.judgments.length !== after.judgments.length) throw Error('Case coverage changed');
  const cases = before.judgments.map(old => {
    const next = after.judgments.find(x => x.mapId === old.mapId && x.orientation === old.orientation);
    if (!next) throw Error('Missing comparison case');
    const a = findAttachment(beforeManifest, old), b = findAttachment(afterManifest, next);
    if (!a || !b || a.conditionId !== b.conditionId) throw Error('Capture conditions changed');
    const deltas = Object.fromEntries(keys.map(key => [key, next.scores[key] - old.scores[key]]));
    return { mapId: old.mapId, orientation: old.orientation, before: total(old.scores), after: total(next.scores), delta: total(next.scores) - total(old.scores), deltas,
      blockers: next.blockingVisualDefects, criterionRegressions: keys.filter(key => deltas[key] < 0), beforeContentId: a.contentId, afterContentId: b.contentId };
  });
  const mean = key => cases.reduce((sum, item) => sum + item[key], 0) / cases.length;
  return { schemaVersion: 1, beforeCaseId: before.caseId, afterCaseId: after.caseId, scale: 'ordinal model judgment mapped to 0–100; not an objective measurement', weights: Object.fromEntries(keys.map(key => [key, 20])), cases,
    meanBefore: mean('before'), meanAfter: mean('after'), meanDelta: mean('delta'),
    reviewRequired: cases.some(x => x.blockers.length || x.criterionRegressions.length || x.delta <= 0),
    note: 'Any changed camera/viewport/preset must also be rejected by the capture review. One run per version does not estimate judge variance. Human/source review remains required.' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [beforePath, afterPath, output] = process.argv.slice(2);
  if (!beforePath || !afterPath || !output || process.argv.length !== 5) throw Error('usage: visual-compare.mjs BEFORE.json AFTER.json OUTPUT.json');
  const result = compare(await read(beforePath), await read(afterPath), await read(`${beforePath}.manifest.json`), await read(`${afterPath}.manifest.json`));
  await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ meanBefore: result.meanBefore, meanAfter: result.meanAfter, meanDelta: result.meanDelta, reviewRequired: result.reviewRequired }));
}
