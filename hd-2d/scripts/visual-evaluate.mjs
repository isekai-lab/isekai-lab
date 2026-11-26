import { createHash } from "node:crypto";
import { copyFile, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, resolve } from "node:path";
import { spawn } from "node:child_process";

const MAPS = new Set(["town", "forest", "cave"]);
const ORIENTATIONS = new Set(["landscape", "portrait"]);
const SCORE_KEYS = ["compositionDepth", "materialPixels", "lightingContact", "routeReadability", "sceneIdentity"];
const here = resolve(import.meta.dirname, "..");
const schemaSource = resolve(here, "visual-loop/evaluation.schema.json");

const fail = (message) => { throw new Error(`visual-evaluate: ${message}`); };
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value, name) => { if (typeof value !== "string" || !value.trim()) fail(`${name} must be a non-empty string`); return value; };
const digest = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const imageType = (file) => [".png", ".jpg", ".jpeg"].includes(extname(file).toLowerCase());
const safeName = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

export function attachmentLabel(kind, image) {
  return kind === "reference"
    ? `reference:${image.role}:${image.mapId}`
    : `candidate:${image.mapId}:${image.orientation}:${image.conditionId}:${image.contentId}`;
}

export async function validatePacket(packet, packetFile) {
  if (!isObject(packet) || packet.schemaVersion !== 1) fail("packet schemaVersion must be 1");
  string(packet.caseId, "caseId");
  if (!Array.isArray(packet.referenceImages) || !Array.isArray(packet.candidateImages)) fail("referenceImages and candidateImages must be arrays");
  if (!packet.candidateImages.length) fail("candidateImages must not be empty");
  if (packet.referenceImages.length + packet.candidateImages.length > 12) fail("at most 12 attachments are allowed");
  const labels = new Set(); const all = [];
  const check = async (kind, image, index) => {
    if (!isObject(image)) fail(`${kind}Images[${index}] must be an object`);
    string(image.path, `${kind}Images[${index}].path`); string(image.mapId, `${kind}Images[${index}].mapId`);
    if (!MAPS.has(image.mapId)) fail(`${kind}Images[${index}].mapId is invalid`);
    if (kind === "reference") { string(image.role, `referenceImages[${index}].role`); string(image.sourceUrl, `referenceImages[${index}].sourceUrl`); }
    else { string(image.orientation, `candidateImages[${index}].orientation`); string(image.conditionId, `candidateImages[${index}].conditionId`); string(image.contentId, `candidateImages[${index}].contentId`); if (!ORIENTATIONS.has(image.orientation)) fail(`candidateImages[${index}].orientation is invalid`); }
    const path = resolve(dirname(packetFile), image.path); const stat = await lstat(path).catch(() => undefined);
    if (!stat || !stat.isFile() || stat.isSymbolicLink() || !imageType(path)) fail(`${kind}Images[${index}] must be an existing regular PNG/JPEG, not a symlink`);
    const label = attachmentLabel(kind, image); if (labels.has(label)) fail(`duplicate attachment label: ${label}`); labels.add(label);
    all.push({ ...image, kind, path, label });
  };
  for (let i = 0; i < packet.referenceImages.length; i++) await check("reference", packet.referenceImages[i], i);
  for (let i = 0; i < packet.candidateImages.length; i++) await check("candidate", packet.candidateImages[i], i);
  string(packet.rubricPath, "rubricPath"); const rubricPath = resolve(dirname(packetFile), packet.rubricPath);
  const rubricStat = await lstat(rubricPath).catch(() => undefined);
  if (!rubricStat || !rubricStat.isFile() || rubricStat.isSymbolicLink()) fail("rubricPath must be an existing regular file, not a symlink");
  return { packet, rubricPath, attachments: all };
}

function promptFor(plan, rubricText) {
  const images = plan.attachments.map((x) => `- ${x.label} (${x.kind}, ${x.mapId}${x.orientation ? `, ${x.orientation}` : ""})`).join("\n");
  return `You are an independent visual reviewer. Use ONLY the attached images and rubric below. Do not inspect code, repositories, implementation descriptions, metadata, or the web. Do not run tools. Do not assume improvement beyond what is visible. Reference images are anchors only: do not score them and do not recommend copying assets.\n\nScore every candidate image exactly once on compositionDepth, materialPixels, lightingContact, routeReadability, and sceneIdentity. Each score is an ordinal integer 0 through 4. Give visible evidence and concrete next changes for every candidate. Record blocking visual defects when present. These are independent agent judgments, not ground truth and not copyright-similarity findings. Do not calculate totals or weighted scores.\n\nRubric:\n${rubricText}\n\nAttachments in exact order:\n${images}\n\nReturn only an object conforming to the supplied JSON schema. Case ID: ${plan.packet.caseId}.`;
}

export function validateJudgment(result, plan) {
  if (!isObject(result) || Object.keys(result).length !== 4 || result.schemaVersion !== 1 || result.caseId !== plan.packet.caseId || !Array.isArray(result.judgments) || !Array.isArray(result.notes)) fail("result does not have matching required root fields");
  const expected = plan.attachments.filter((x) => x.kind === "candidate"); const seen = new Set();
  if (result.judgments.length !== expected.length) fail("result must contain exactly one judgment per candidate");
  for (const judgment of result.judgments) {
    if (!isObject(judgment) || Object.keys(judgment).length !== 8) fail("judgment has missing or extra fields");
    const candidate = expected.find((x) => x.label === judgment.imageLabel);
    if (!candidate || seen.has(candidate.label) || judgment.mapId !== candidate.mapId || judgment.orientation !== candidate.orientation) fail("judgment labels, maps, or orientations do not exactly match candidates");
    seen.add(candidate.label);
    for (const name of ["blockingVisualDefects", "nextChanges"]) if (!Array.isArray(judgment[name]) || !judgment[name].every((x) => typeof x === "string")) fail(`${name} must be string arrays`);
    if (!Number.isFinite(judgment.confidence) || judgment.confidence < 0 || judgment.confidence > 1) fail("confidence must be 0..1");
    for (const group of ["scores", "evidence"]) if (!isObject(judgment[group]) || Object.keys(judgment[group]).length !== SCORE_KEYS.length) fail(`${group} must contain exactly five criteria`);
    for (const key of SCORE_KEYS) { if (!Number.isInteger(judgment.scores[key]) || judgment.scores[key] < 0 || judgment.scores[key] > 4) fail(`invalid score ${key}`); if (typeof judgment.evidence[key] !== "string") fail(`invalid evidence ${key}`); }
  }
  if (!result.notes.every((x) => typeof x === "string")) fail("notes must be strings");
  return result;
}

const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, val]) => {
    const usageCount = ["input_tokens", "cached_input_tokens", "cache_write_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens"].includes(key) && Number.isFinite(val);
    return /token|secret|password|authorization|cookie|api[_-]?key/i.test(key) && !usageCount ? [key, "<redacted>"] : [key, sanitize(val)];
  }));
  return typeof value === "string" ? value.replace(/(?:\/[^\s"']+)+/g, "<path>") : value;
};
const cliVersion = async (command) => new Promise((done) => { const child = spawn(command, ["--version"], { stdio: ["ignore", "pipe", "ignore"] }); let out = ""; child.stdout.on("data", (x) => out += x); child.on("error", () => done("unavailable")); child.on("close", () => done(out.trim() || "unavailable")); });

export async function run(packetFile, output, { dryRun = false, executable = process.env.CODEX_EXECUTABLE || "codex" } = {}) {
  const plan = await validatePacket(JSON.parse(await readFile(packetFile, "utf8")), packetFile);
  const prompt = promptFor(plan, await readFile(plan.rubricPath, "utf8"));
  const manifest = { schemaVersion: 1, caseId: plan.packet.caseId, executionStatus: dryRun ? "dry-run" : "pending", attachments: await Promise.all(plan.attachments.map(async (x) => ({ label: x.label, kind: x.kind, mapId: x.mapId, orientation: x.orientation, conditionId: x.conditionId, contentId: x.contentId, sha256: await digest(x.path) }))), rubricSha256: await digest(plan.rubricPath) };
  if (dryRun) return { dryRun: true, caseId: plan.packet.caseId, attachments: manifest.attachments.map(({ label }) => label), prompt };
  const evidenceDir = await mkdtemp(resolve(tmpdir(), "hd2d-visual-evidence-")); const resultFile = resolve(evidenceDir, "result.json"); const schema = resolve(evidenceDir, "evaluation.schema.json");
  try {
    await copyFile(schemaSource, schema); await copyFile(plan.rubricPath, resolve(evidenceDir, "rubric" + extname(plan.rubricPath)));
    const imagePaths = [];
    for (let i = 0; i < plan.attachments.length; i++) { const target = resolve(evidenceDir, `${String(i).padStart(2, "0")}-${safeName(plan.attachments[i].label)}${extname(plan.attachments[i].path).toLowerCase()}`); await copyFile(plan.attachments[i].path, target); imagePaths.push(target); }
    await writeFile(resolve(evidenceDir, "prompt.txt"), prompt);
    const args = ["exec", "--ignore-user-config", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", evidenceDir, "--json", "--output-schema", schema, "--output-last-message", resultFile, ...imagePaths.flatMap((path) => ["--image", path]), "-"];
    manifest.cli = { version: await cliVersion(executable), args: ["exec", "--ignore-user-config", "--ephemeral", "--sandbox", "read-only", "--skip-git-repo-check", "-C", "<evidence-dir>", "--json", "--output-schema", "evaluation.schema.json", "--output-last-message", "result.json", ...plan.attachments.flatMap((x) => ["--image", x.label]), "-"] };
    const execution = await new Promise((done) => { const child = spawn(executable, args, { cwd: evidenceDir, stdio: ["pipe", "pipe", "pipe"] }); let stdout = "", stderr = ""; const timer = setTimeout(() => { child.kill("SIGKILL"); }, 600_000); child.stdout.on("data", (x) => stdout += x); child.stderr.on("data", (x) => stderr += x); child.on("error", (error) => done({ code: -1, stdout, stderr: `${stderr}${error.message}`, timedOut: false })); child.on("close", (code, signal) => { clearTimeout(timer); done({ code, stdout, stderr, timedOut: signal === "SIGKILL" }); }); child.stdin.end(prompt); });
    const events = execution.stdout.split(/\r?\n/).filter(Boolean).map((line) => { try { return JSON.parse(line); } catch { return { event: "unparseable-cli-output" }; } });
    const forbiddenItems = new Set(["command_execution", "mcp_tool_call", "web_search", "file_change", "tool_call"]);
    manifest.audit = { toolUseDetected: events.some(event => forbiddenItems.has(event.item?.type)), model: execution.stderr.match(/^model:\s*(.+)$/m)?.[1]?.trim() ?? "not-reported-by-cli" };
    const eventLog = events.map(event => JSON.stringify(sanitize(event))).join("\n") + "\n";
    await writeFile(`${output}.events.jsonl`, eventLog);
    if (execution.code !== 0 || execution.timedOut) { manifest.executionStatus = "error"; manifest.error = execution.timedOut ? "codex execution timed out" : `codex exited ${execution.code}`; await writeFile(`${output}.manifest.json`, JSON.stringify(manifest, null, 2) + "\n"); fail(manifest.error); }
    if (manifest.audit.toolUseDetected) fail("reviewer used tools; source-blind evaluation rejected");
    const judgment = validateJudgment(JSON.parse(await readFile(resultFile, "utf8")), plan);
    await writeFile(output, JSON.stringify(judgment, null, 2) + "\n"); manifest.executionStatus = "success"; await writeFile(`${output}.manifest.json`, JSON.stringify(manifest, null, 2) + "\n"); return judgment;
  } catch (error) { if (manifest.executionStatus === "pending") { manifest.executionStatus = "error"; manifest.error = error instanceof Error ? error.message : String(error); await writeFile(`${output}.manifest.json`, JSON.stringify(manifest, null, 2) + "\n"); } throw error; }
  finally { await rm(evidenceDir, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2); const dryRun = args.includes("--dry-run"); const positional = args.filter((x) => x !== "--dry-run");
  if (positional.length !== 4 || positional[0] !== "--packet" || positional[2] !== "--output") fail("usage: visual-evaluate.mjs --packet PATH --output PATH [--dry-run]");
  const response = await run(resolve(positional[1]), resolve(positional[3]), { dryRun }); if (dryRun) console.log(JSON.stringify(response));
}
