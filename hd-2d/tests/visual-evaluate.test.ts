import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// @ts-ignore -- the production runner is intentionally a plain Node ESM script.
const runner = await import("../scripts/visual-evaluate.mjs");

const png = Buffer.from("89504e470d0a1a0a", "hex");
const fixture = () => {
  const dir = mkdtempSync(join(tmpdir(), "visual-evaluate-test-"));
  writeFileSync(join(dir, "ref.png"), png); writeFileSync(join(dir, "candidate.png"), png);
  writeFileSync(join(dir, "rubric.md"), "Visible-image rubric only.");
  const packet = { schemaVersion: 1, caseId: "case-a", referenceImages: [{ path: "ref.png", role: "style-anchor", mapId: "town", sourceUrl: "https://example.invalid/reference" }], candidateImages: [{ path: "candidate.png", mapId: "town", orientation: "landscape", conditionId: "fixed", contentId: "capture-1" }], rubricPath: "rubric.md" };
  writeFileSync(join(dir, "packet.json"), JSON.stringify(packet));
  return { dir, packet, packetFile: join(dir, "packet.json") };
};
const validResult = () => ({ schemaVersion: 1, caseId: "case-a", judgments: [{ imageLabel: "candidate:town:landscape:fixed:capture-1", mapId: "town", orientation: "landscape", scores: { compositionDepth: 2, materialPixels: 3, lightingContact: 1, routeReadability: 4, sceneIdentity: 2 }, evidence: { compositionDepth: "layers are visible", materialPixels: "tile edges read", lightingContact: "contact is weak", routeReadability: "route is clear", sceneIdentity: "town landmark appears" }, blockingVisualDefects: [], nextChanges: ["strengthen contact shadows"], confidence: .75 }], notes: ["ordinal visual judgment"] });

test("structured-output schema declares property types including const and enum fields", () => {
  const schema = JSON.parse(readFileSync(new URL('../visual-loop/evaluation.schema.json', import.meta.url), 'utf8'));
  const check = (node: any): void => {
    assert.ok(node.type || node.$ref, 'Every response schema node needs a type or reference');
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
      Object.values(node.properties).forEach(check);
    }
    if (node.items) check(node.items);
  };
  check(schema);
  Object.values(schema.$defs).forEach(check);
});

test("visual evaluator creates deterministic labels and dry-run plan without invoking Codex", async () => {
  const f = fixture();
  try {
    const plan = await runner.run(f.packetFile, join(f.dir, "out.json"), { dryRun: true });
    assert.deepEqual(plan.attachments, ["reference:style-anchor:town", "candidate:town:landscape:fixed:capture-1"]);
    assert.match(plan.prompt, /Use ONLY the attached images and rubric below/);
    assert.match(plan.prompt, /do not calculate totals or weighted scores/i);
    assert.throws(() => readFileSync(join(f.dir, "out.json")));
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test("visual evaluator rejects invalid packet attachments and duplicate labels", async () => {
  const f = fixture();
  try {
    f.packet.candidateImages.push({ ...f.packet.candidateImages[0] });
    await assert.rejects(runner.validatePacket(f.packet, f.packetFile), /duplicate attachment label/);
    f.packet.candidateImages = [{ ...f.packet.candidateImages[0], orientation: "square" }];
    await assert.rejects(runner.validatePacket(f.packet, f.packetFile), /orientation is invalid/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test("visual evaluator requires exact candidate coverage and bounded numeric scores", async () => {
  const f = fixture();
  try {
    const plan = await runner.validatePacket(f.packet, f.packetFile);
    assert.deepEqual(runner.validateJudgment(validResult(), plan), validResult());
    const missing = validResult(); missing.judgments = [];
    assert.throws(() => runner.validateJudgment(missing, plan), /exactly one judgment/);
    const invalid = validResult(); invalid.judgments[0].scores.sceneIdentity = 4.2;
    assert.throws(() => runner.validateJudgment(invalid, plan), /invalid score sceneIdentity/);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test("visual evaluator constructs a constrained Codex invocation with a mock executable", async () => {
  const f = fixture();
  try {
    const executable = join(f.dir, "mock-codex.mjs"); const result = JSON.stringify(validResult());
    writeFileSync(executable, `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nconst a=process.argv.slice(2); if(a[0]==='--version'){console.log('mock-codex 1');process.exit(0)} const p=a[a.indexOf('--output-last-message')+1]; writeFileSync(p, ${JSON.stringify(result)}); console.log(JSON.stringify({type:'completed'}));\n`);
    chmodSync(executable, 0o755);
    const output = join(f.dir, "judgment.json");
    await runner.run(f.packetFile, output, { executable });
    const manifest = JSON.parse(readFileSync(`${output}.manifest.json`, "utf8"));
    assert.equal(manifest.executionStatus, "success");
    assert.deepEqual(manifest.cli.args.slice(0, 8), ["exec", "--ignore-user-config", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", "<evidence-dir>"]);
    assert.deepEqual(JSON.parse(readFileSync(output, "utf8")), validResult());
    writeFileSync(executable, `#!/usr/bin/env node\nimport { writeFileSync } from 'node:fs';\nconst a=process.argv.slice(2); if(a[0]==='--version'){console.log('mock-codex 1');process.exit(0)} writeFileSync(a[a.indexOf('--output-last-message')+1], ${JSON.stringify(result)}); console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution'}}));\n`);
    const rejected = join(f.dir, "rejected.json");
    await assert.rejects(runner.run(f.packetFile, rejected, { executable }), /reviewer used tools/);
    assert.equal(JSON.parse(readFileSync(`${rejected}.manifest.json`, "utf8")).executionStatus, "error");
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
