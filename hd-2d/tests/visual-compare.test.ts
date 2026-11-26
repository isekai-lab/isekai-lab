import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-ignore -- Node ESM tooling is intentionally JavaScript.
import { compare } from '../scripts/visual-compare.mjs';

test('visual comparison rejects rubric/reference/condition changes and flags criterion regressions', () => {
  const score = { compositionDepth: 2, materialPixels: 2, lightingContact: 2, routeReadability: 2, sceneIdentity: 2 };
  const before = { caseId: 'a', judgments: [{ imageLabel: 'old', mapId: 'town', orientation: 'landscape', scores: score, blockingVisualDefects: [] }] };
  const after = { caseId: 'b', judgments: [{ ...before.judgments[0], imageLabel: 'new', scores: { ...score, compositionDepth: 4, routeReadability: 1 } }] };
  const manifest = (label: string) => ({ rubricSha256: 'fixed', attachments: [{ label: 'ref', kind: 'reference', sha256: 'refhash' }, { label, kind: 'candidate', conditionId: 'fixed', contentId: label }] });
  const a = manifest('old'), b = manifest('new');
  const result = compare(before, after, a, b);
  assert.equal(result.meanBefore, 50);
  assert.equal(result.meanAfter, 55);
  assert.equal(result.reviewRequired, true);
  assert.deepEqual(result.cases[0].criterionRegressions, ['routeReadability']);
  assert.throws(() => compare(before, after, a, { ...b, rubricSha256: 'changed' }), /Rubric changed/);
  const changedRef = structuredClone(b); changedRef.attachments[0].sha256 = 'other';
  assert.throws(() => compare(before, after, a, changedRef), /Reference anchors changed/);
  const changedCondition = structuredClone(b); changedCondition.attachments[1].conditionId = 'other';
  assert.throws(() => compare(before, after, a, changedCondition), /Capture conditions changed/);
});
