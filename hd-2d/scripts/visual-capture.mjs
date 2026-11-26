import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const DEFAULT_URL = "http://127.0.0.1:4310/maps.html";
const DEFAULT_OUTPUT = resolve(import.meta.dirname, "../../.local/hd2d-visual-loop/baseline");
const CAPTURE_PROTOCOL_VERSION = 1;
const IMAGE_PROTOCOL = "image is a screenshot of the visible #world canvas after static benchmark completion, with sibling UI overlays temporarily visibility-hidden; rawImage is the capture-png RenderTarget export retained as a diagnostic because it can omit post-processing.";
const READY_TIMEOUT_MS = 90_000;
const BENCHMARK_TIMEOUT_MS = 90_000;
const validMaps = new Set(["town", "forest", "cave"]);
const require = createRequire(import.meta.url);
const now = () => new Date().toISOString();

function parseArgs(args) {
  const value = (flag, fallback) => { const i = args.indexOf(flag); if (i < 0) return fallback; if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`missing ${flag} value`); return args[i + 1]; };
  if (args.some((arg) => arg.startsWith("--") && !["--url", "--output", "--maps", "--raw"].includes(arg))) throw new Error("usage: visual-capture.mjs [--url URL] [--output DIR] [--maps town,forest,cave] [--raw]");
  const maps = value("--maps", "town,forest,cave").split(",").filter(Boolean);
  if (!maps.length || new Set(maps).size !== maps.length || maps.some((map) => !validMaps.has(map))) throw new Error("--maps must be a unique comma-separated subset of town,forest,cave");
  return { url: value("--url", DEFAULT_URL), output: resolve(value("--output", DEFAULT_OUTPUT)), maps, raw: args.includes("--raw") };
}
function playwright() {
  const modulePath = process.env.PLAYWRIGHT_MODULE || "playwright-core";
  try { return require(modulePath); } catch (error) { throw new Error(`Playwright unavailable at ${modulePath}; set PLAYWRIGHT_MODULE (${error instanceof Error ? error.message : error})`); }
}

async function pageState(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#world");
    return {
      status: document.querySelector("#status")?.textContent ?? "missing",
      statusBad: document.querySelector("#status")?.getAttribute("data-bad"),
      summary: document.querySelector("#benchmark-summary")?.textContent ?? "missing",
      exportDisabled: document.querySelector("#export-report")?.disabled,
      canvasClient: canvas ? [canvas.clientWidth, canvas.clientHeight] : undefined,
      canvasBacking: canvas ? [canvas.width, canvas.height] : undefined,
      window: [innerWidth, innerHeight, devicePixelRatio],
      hidden: document.hidden,
      performanceNow: Math.round(performance.now()),
    };
  }).catch((error) => ({ diagnosticError: error instanceof Error ? error.message : String(error) }));
}

async function waitForReady(page, errors, label) {
  try {
    await page.locator("#status").filter({ hasText: "準備完了" }).waitFor({ timeout: READY_TIMEOUT_MS });
  } catch (error) {
    throw new Error(`${label} did not become ready within ${READY_TIMEOUT_MS}ms state=${JSON.stringify(await pageState(page))} browserErrors=${JSON.stringify(errors)}; ${error instanceof Error ? error.message : error}`);
  }
}

async function waitForBenchmark(page, errors) {
  try {
    await page.locator("#export-report:not([disabled])").waitFor({ timeout: BENCHMARK_TIMEOUT_MS });
  } catch (error) {
    const state = await pageState(page);
    const browserErrors = errors.length ? ` browserErrors=${JSON.stringify(errors)}` : "";
    throw new Error(`benchmark did not complete within ${BENCHMARK_TIMEOUT_MS}ms state=${JSON.stringify(state)}${browserErrors}; ${error instanceof Error ? error.message : error}`);
  }
}

export async function capture({ url = DEFAULT_URL, output = DEFAULT_OUTPUT, maps = ["town", "forest", "cave"], raw = false } = {}) {
  if (!Array.isArray(maps) || !maps.length || maps.some((map) => !validMaps.has(map))) throw new Error("maps must be a non-empty subset of town,forest,cave");
  const profile = await mkdtemp(resolve(tmpdir(), "hd2d-visual-capture-profile-"));
  const manifest = { schemaVersion: 1, captureProtocolVersion: CAPTURE_PROTOCOL_VERSION, startedAt: now(), executionStatus: "running", url, browser: { executable: "Google Chrome", headless: true, profile: "temporary separate profile" }, measurement: "Headless Chrome software/CPU scene.render wall-time and frame intervals only; not real-phone, GPU, or device performance.", imageProtocol: IMAGE_PROTOCOL, captures: [] };
  try {
    const prior = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8"));
    const compatible = prior.schemaVersion === manifest.schemaVersion
      && (prior.captureProtocolVersion ?? 1) === manifest.captureProtocolVersion
      && prior.url === manifest.url
      && prior.imageProtocol === manifest.imageProtocol;
    if (compatible && Array.isArray(prior.captures)) manifest.captures = prior.captures.filter((item) => !maps.includes(item.mapId));
  } catch { /* First run, or no reusable local manifest. */ }
  let context;
  try {
    await mkdir(output, { recursive: true });
    context = await playwright().chromium.launchPersistentContext(profile, { ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: "chrome" }), headless: true, acceptDownloads: true, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, args: ["--disable-background-networking", "--disable-sync", "--no-first-run", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const page = context.pages()[0] ?? await context.newPage(); const errors = [];
    manifest.browser.version = context.browser()?.version() ?? "unknown";
    manifest.browser.renderer = await page.evaluate(() => { const gl = document.createElement("canvas").getContext("webgl"); const debug = gl?.getExtension("WEBGL_debug_renderer_info"); return debug ? gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable"; });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    const conditions = [{ orientation: "landscape", quality: "standard", width: 1280, height: 720, lightweight: false }, { orientation: "portrait", quality: "light", width: 393, height: 852, lightweight: true }];
    for (const mapId of maps) for (const condition of conditions) {
      await page.setViewportSize({ width: condition.width, height: condition.height });
      await page.goto(url, { waitUntil: "networkidle" });
      await waitForReady(page, errors, `${mapId}/${condition.orientation} initial scene`);
      await page.evaluate(() => { const button = document.querySelector("#toggle-controls"); if (button && document.querySelector("#controls")?.classList.contains("collapsed")) button.click(); });
      const mapButton = page.locator(`[data-map="${mapId}"]`);
      if (await mapButton.getAttribute("aria-pressed") !== "true") await mapButton.click({ timeout: READY_TIMEOUT_MS });
      await waitForReady(page, errors, `${mapId}/${condition.orientation} selected scene`);
      const light = page.locator('input[data-setting="lightweight"]'); if (await light.isChecked() !== condition.lightweight) await light.click();
      await page.locator("#benchmark").click();
      await waitForBenchmark(page, errors);
      if (errors.length) throw new Error(`browser errors while ${mapId}/${condition.orientation}: ${errors.join(" | ")}`);
      const stem = `${mapId}-${condition.quality}-${condition.orientation}`;
      const [reportDownload] = await Promise.all([page.waitForEvent("download"), page.locator("#export-report").click()]);
      const reportPath = resolve(output, `${stem}.json`); await reportDownload.saveAs(reportPath);
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      if (report.metadata?.mapId !== mapId || report.metadata?.preset !== stem || report.metadata?.schemaVersion !== 1 || report.metadata?.presetVersion !== 2 || report.viewport?.css?.join("x") !== `${condition.width}x${condition.height}` || report.viewport?.dpr !== 1 || report.viewport?.quality !== condition.quality || report.time?.animation !== "paused-static") throw new Error(`report coverage mismatch for ${stem}`);
      if (!report.metadata?.contentId || report.metadata.contentId !== report.metadata.buildId) throw new Error(`contentId mismatch for ${stem}`);
      manifest.captures = manifest.captures.filter((item) => item.contentId === report.metadata.contentId);
      await page.addStyleTag({ content: "body * { visibility: hidden !important; } #world { visibility: visible !important; }" });
      try { await page.locator("#world").screenshot({ path: resolve(output, `${stem}.png`) }); }
      finally { await page.evaluate(() => document.querySelectorAll("style").forEach((style) => { if (style.textContent === "body * { visibility: hidden !important; } #world { visibility: visible !important; }") style.remove(); })); }
      if (raw) {
        const [imageDownload] = await Promise.all([page.waitForEvent("download"), page.locator("#capture-png").click()]);
        await imageDownload.saveAs(resolve(output, `${stem}-raw.png`));
      }
      manifest.captures.push({ mapId, orientation: condition.orientation, quality: condition.quality, viewport: [condition.width, condition.height], dpr: 1, image: `${stem}.png`, ...(raw ? {rawImage: `${stem}-raw.png`} : {}), report: `${stem}.json`, contentId: report.metadata.contentId, capturedAt: now() });
      await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
      console.log(`captured ${stem}`);
    }
    if (errors.length || maps.some((mapId) => manifest.captures.filter((item) => item.mapId === mapId).length !== 2)) throw new Error(errors.join(" | ") || "missing capture coverage");
    if (new Set(manifest.captures.map((item) => item.contentId)).size !== 1) throw new Error("contentId mismatch across captures");
    manifest.executionStatus = "success"; manifest.finishedAt = now(); await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n"); return manifest;
  } catch (error) { manifest.executionStatus = "error"; manifest.finishedAt = now(); manifest.error = error instanceof Error ? error.message : String(error); await mkdir(output, { recursive: true }); await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n"); throw error; }
  finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
}

if (import.meta.url === `file://${process.argv[1]}`) { const options = parseArgs(process.argv.slice(2)); const result = await capture(options); console.log(JSON.stringify({ executionStatus: result.executionStatus, captures: result.captures.length, output: options.output })); }
