import {
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { defaultSettings, validSettings, type ViewerSettings } from "./contracts.ts";
import { maps } from "./maps.ts";
import { createWorld, type WorldHandle } from "./world.ts";

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = byId<HTMLCanvasElement>("world");
const status = byId<HTMLElement>("status");
const controls = byId<HTMLElement>("controls");

let settings: ViewerSettings = { ...defaultSettings };
let engine: Engine | undefined;
let scene: Scene | undefined;
let world: WorldHandle | undefined;
let camera: ArcRotateCamera | undefined;
let sun: DirectionalLight | undefined;
let sky: HemisphericLight | undefined;
let shadowGenerator: ShadowGenerator | undefined;
let pipeline: DefaultRenderingPipeline | undefined;
let animationSeconds = 0;

function setStatus(message: string, bad = false): void {
  if (status.textContent !== message) status.textContent = message;
  status.dataset.bad = bad ? "true" : "false";
}

function reportStartupFailure(): void {
  setStatus("読込に失敗しました。WebGL の設定を確認してください", true);
}

window.addEventListener("error", reportStartupFailure);
window.addEventListener("unhandledrejection", reportStartupFailure);

function syncUi(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => {
    const active = button.dataset.map === settings.mapId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  for (const key of ["dusk", "lightweight", "shadows", "effects", "paused"] as const) {
    const input = document.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
    if (input) input.checked = settings[key];
  }
  byId<HTMLInputElement>("zoom").value = String(settings.zoom);
  byId<HTMLInputElement>("yaw").value = String(settings.yaw);
}

function applyCamera(): void {
  if (!engine || !camera || !world) return;
  const renderWidth = Math.max(1, engine.getRenderWidth());
  const renderHeight = Math.max(1, engine.getRenderHeight());
  const aspect = renderWidth / renderHeight;
  const contentHalfWidth = world.bounds;
  const landscapeHalfHeight = settings.mapId === "town" ? 9.5 : 10.2;
  const halfWidth = Math.max(contentHalfWidth, landscapeHalfHeight * aspect) / settings.zoom;
  const halfHeight = halfWidth / aspect;

  camera.alpha = -Math.PI / 4 + settings.yaw;
  camera.beta = 1.02;
  camera.radius = 30;
  camera.setTarget(world.target);
  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
}

function rebuildShadowGenerator(): void {
  if (!scene || !sun || !world) return;
  shadowGenerator?.dispose();
  shadowGenerator = new ShadowGenerator(settings.lightweight ? 512 : 1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = !settings.lightweight;
  shadowGenerator.blurKernel = settings.lightweight ? 4 : 12;
  shadowGenerator.setDarkness(settings.dusk ? 0.46 : 0.32);
  for (const caster of world.shadowCasters) shadowGenerator.addShadowCaster(caster, false);
  scene.shadowsEnabled = settings.shadows;
}

function rebuildWorld(): void {
  if (!scene || !engine) return;
  world?.dispose();
  world = createWorld(scene, maps[settings.mapId], settings.lightweight);
  animationSeconds = 0;
  engine.setHardwareScalingLevel(
    settings.lightweight
      ? Math.max(1.7, window.devicePixelRatio || 1)
      : Math.max(1, Math.min(window.devicePixelRatio || 1, 1.4)),
  );
  engine.resize();
  applyCamera();
  rebuildShadowGenerator();
  syncUi();
}

function applyRenderingSettings(): void {
  if (!scene || !sun || !sky || !pipeline) return;
  if (settings.dusk) {
    sun.direction.set(-0.78, -0.58, 0.22);
    sun.intensity = 1.22;
    sun.diffuse = Color3.FromHexString("#ef9d68");
    sky.intensity = 0.46;
    sky.diffuse = Color3.FromHexString("#7890b5");
    sky.groundColor = Color3.FromHexString("#26354e");
    scene.clearColor = Color4.FromHexString("#17283cff");
    scene.fogColor = Color3.FromHexString("#5f7184");
  } else {
    sun.direction.set(-0.48, -1, 0.3);
    sun.intensity = 1.55;
    sun.diffuse = Color3.FromHexString("#fff0cc");
    sky.intensity = 0.68;
    sky.diffuse = Color3.FromHexString("#b7d0d0");
    sky.groundColor = Color3.FromHexString("#40535a");
    scene.clearColor = Color4.FromHexString("#8aa1a8ff");
    scene.fogColor = Color3.FromHexString("#8aa1a8");
  }
  scene.ambientColor = settings.dusk
    ? Color3.FromHexString("#263653")
    : Color3.FromHexString("#6c7f80");
  scene.shadowsEnabled = settings.shadows;
  scene.fogDensity = settings.effects ? (settings.mapId === "forest" ? 0.014 : 0.008) : 0;
  pipeline.bloomEnabled = settings.effects;
  pipeline.bloomThreshold = 0.78;
  pipeline.bloomWeight = 0.2;
  pipeline.bloomKernel = settings.lightweight ? 24 : 40;
  pipeline.samples = settings.lightweight ? 1 : 2;
  pipeline.fxaaEnabled = !settings.lightweight;
  scene.imageProcessingConfiguration.contrast = settings.effects ? 1.12 : 1;
  scene.imageProcessingConfiguration.exposure = settings.dusk ? 0.92 : 1.02;
  scene.imageProcessingConfiguration.vignetteEnabled = settings.effects;
  scene.imageProcessingConfiguration.vignetteWeight = 1.4;
  scene.imageProcessingConfiguration.vignetteColor = settings.dusk
    ? Color4.FromHexString("#10182bff")
    : Color4.FromHexString("#2b3c40ff");
  shadowGenerator?.setDarkness(settings.dusk ? 0.46 : 0.32);
}

function setup(): void {
  if (!Engine.isSupported()) {
    setStatus("このブラウザでは WebGL を利用できません", true);
    return;
  }
  try {
    engine = new Engine(canvas, true, { adaptToDeviceRatio: false, stencil: true }, false);
    scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    scene.fogMode = Scene.FOGMODE_EXP2;

    camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 4,
      1.02,
      30,
      Vector3.Zero(),
      scene,
    );
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.inputs.clear();
    camera.minZ = 0.2;
    camera.maxZ = 100;

    sun = new DirectionalLight("sun", new Vector3(-0.48, -1, 0.3), scene);
    sun.position.set(12, 22, -15);
    sky = new HemisphericLight("sky", Vector3.Up(), scene);
    pipeline = new DefaultRenderingPipeline("world-effects", false, scene, [camera]);
    pipeline.fxaaEnabled = !settings.lightweight;

    rebuildWorld();
    applyRenderingSettings();

    let previousFrame = performance.now();
    let previousStatus = previousFrame;
    engine.runRenderLoop(() => {
      if (!scene || !engine) return;
      const now = performance.now();
      const deltaSeconds = Math.min(0.1, Math.max(0, now - previousFrame) / 1000);
      previousFrame = now;
      if (!settings.paused) animationSeconds += deltaSeconds;
      world?.update(animationSeconds);
      scene.render();
      if (now - previousStatus > 2000) {
        setStatus(`準備完了 · ${maps[settings.mapId].name} · ${Math.round(engine.getFps())} FPS`);
        previousStatus = now;
      }
    });

    window.addEventListener("resize", () => {
      engine?.resize();
      applyCamera();
    });
    if (window.matchMedia("(max-width: 620px)").matches) controls.classList.add("collapsed");
    document.querySelector<HTMLElement>(".notice")?.remove();
    setStatus("読込完了 · マップを生成しました");
  } catch (error) {
    console.error(error);
    reportStartupFailure();
  }
}

function downloadSettings(): void {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hd2d-settings.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => {
  button.addEventListener("click", () => {
    settings.mapId = button.dataset.map as ViewerSettings["mapId"];
    rebuildWorld();
    applyRenderingSettings();
  });
});
byId<HTMLInputElement>("zoom").addEventListener("input", (event) => {
  settings.zoom = Number((event.target as HTMLInputElement).value);
  applyCamera();
});
byId<HTMLInputElement>("yaw").addEventListener("input", (event) => {
  settings.yaw = Number((event.target as HTMLInputElement).value);
  applyCamera();
});
document.querySelectorAll<HTMLInputElement>("[data-setting]").forEach((input) => {
  input.addEventListener("change", () => {
    const key = input.dataset.setting as keyof ViewerSettings;
    (settings as unknown as Record<string, boolean>)[key] = input.checked;
    if (key === "lightweight") rebuildWorld();
    applyRenderingSettings();
  });
});
byId<HTMLButtonElement>("reset").addEventListener("click", () => {
  settings = { ...defaultSettings };
  rebuildWorld();
  applyRenderingSettings();
});
byId<HTMLButtonElement>("save").addEventListener("click", downloadSettings);
byId<HTMLInputElement>("restore").addEventListener("change", async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const candidate: unknown = JSON.parse(await file.text());
    if (!validSettings(candidate)) throw new Error("Invalid viewer settings");
    settings = candidate;
    rebuildWorld();
    applyRenderingSettings();
    setStatus("設定を復元しました");
  } catch {
    setStatus("設定JSONの形式が違います", true);
  }
});
byId<HTMLButtonElement>("toggle-controls").addEventListener("click", () => {
  controls.classList.toggle("collapsed");
});

setup();
