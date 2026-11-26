import {
    ArcRotateCamera,
    Camera,
    Color3,
    Color4,
    CreateScreenshotUsingRenderTargetAsync,
    DefaultRenderingPipeline,
    DirectionalLight,
    Engine,
    HemisphericLight,
    Plane,
    Scene,
    SceneInstrumentation,
    ShadowGenerator,
    Vector3,
} from "@babylonjs/core";
import { defaultSettings, type MapId, type ViewerSettings } from "../contracts/index.ts";
import { maps } from "../maps/definitions.ts";
import { createWorld, type WorldHandle } from "../maps/world.ts";
import { createCharacterFixture } from "../characters/visual.ts";
import { createCharacterController } from "../characters/controller.ts";
import { createWalkCourseWorld } from "../fixtures/walk-course-visual.ts";
import { abortBenchmark, beginBenchmark, benchmarkPercentiles, BENCHMARK_PRESET_VERSION, BENCHMARK_SCHEMA_VERSION, captureBenchmark, markBenchmarkReady, type BenchmarkState } from "./benchmark.ts";
import { benchmarkPreset, normalizeSettings } from "./settings.ts";
type Page = "index" | "maps" | "characters";
const byId = <T extends HTMLElement>(name: string): T => document.getElementById(name) as T;
function download(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
function downloadUrl(url: string, name: string): void {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
}
export function startViewer(page: Page): void {
    const canvas = byId<HTMLCanvasElement>("world");
    const status = byId<HTMLOutputElement>("status");
    const live = byId<HTMLOutputElement>("live-fps");
    const summary = byId<HTMLOutputElement>("benchmark-summary");
    const controls = byId<HTMLElement>("controls");
    let settings: ViewerSettings = { ...defaultSettings };
    let engine: Engine;
    let scene: Scene;
    let world: WorldHandle;
    let camera: ArcRotateCamera;
    let sun: DirectionalLight;
    let sky: HemisphericLight;
    let pipeline: DefaultRenderingPipeline;
    let shadows: ShadowGenerator | undefined;
    let instrumentation: SceneInstrumentation;
    let actor: ReturnType<typeof createCharacterFixture> | undefined;
    let controller: ReturnType<typeof createCharacterController> | undefined;
    let benchmark: BenchmarkState | undefined;
    let report: Record<string, unknown> | undefined;
    let animationSeconds = 0;
    let previous = performance.now();
    let fpsAt = previous;
    let fpsFrames = 0;
    const keys = new Set<string>();
    let pointerTarget: Readonly<{ x: number; z: number }> | undefined;
    const setStatus = (message: string, bad = false) => {
        status.textContent = message;
        status.dataset.bad = String(bad);
    };
    const conditionKey = () => JSON.stringify({
        settings,
        page,
        css: [canvas.clientWidth, canvas.clientHeight],
        render: [engine?.getRenderWidth(), engine?.getRenderHeight()],
        hidden: document.hidden,
    });
    const cancelBenchmark = (reason: string) => {
        if (benchmark && !["complete", "aborted"].includes(benchmark.phase)) {
            abortBenchmark(benchmark, reason);
            summary.textContent = `計測中止: ${reason}`;
        }
        if (report) {
            report = undefined;
            byId<HTMLButtonElement>("export-report").disabled = true;
            summary.textContent = `計測結果は失効しました: ${reason}`;
        }
    };
    const syncUi = () => {
        document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => {
            const active = button.dataset.map === settings.mapId;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        for (const key of ["dusk", "lightweight", "shadows", "effects", "paused"] as const) {
            const input = document.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
            if (input)
                input.checked = settings[key];
        }
        byId<HTMLInputElement>("zoom").value = String(settings.zoom);
        byId<HTMLInputElement>("yaw").value = String(settings.yaw);
    };
    const applyCamera = () => {
        const aspect = Math.max(1, engine.getRenderWidth()) / Math.max(1, engine.getRenderHeight());
        const environment = maps[settings.mapId].environment;
        const desiredHalfHeight = (environment?.orthoHalfHeight ?? 10) / settings.zoom;
        const halfWidth = Math.max(world.bounds / settings.zoom, desiredHalfHeight * aspect);
        camera.alpha = (environment?.cameraYaw ?? -Math.PI / 4) + settings.yaw;
        camera.beta = environment?.cameraBeta ?? 1.02;
        camera.radius = 30;
        camera.setTarget(world.target);
        camera.orthoLeft = -halfWidth;
        camera.orthoRight = halfWidth;
        camera.orthoTop = halfWidth / aspect;
        camera.orthoBottom = -halfWidth / aspect;
    };
    const applyRendering = () => {
        const cave = maps[settings.mapId].environment?.palette === "cave";
        sun.direction.set(settings.dusk ? -.78 : -.48, settings.dusk ? -.58 : -1, settings.dusk ? .22 : .3);
        sun.intensity = cave ? .85 : settings.dusk ? 1.22 : 1.55;
        sun.diffuse = Color3.FromHexString(settings.dusk || cave ? "#ef9d68" : "#fff0cc");
        sky.intensity = cave ? .25 : settings.dusk ? .46 : .68;
        sky.diffuse = Color3.FromHexString(cave ? "#526079" : settings.dusk ? "#7890b5" : "#b7d0d0");
        sky.groundColor = Color3.FromHexString(cave ? "#182033" : settings.dusk ? "#26354e" : "#40535a");
        scene.clearColor = Color4.FromHexString(cave ? "#101722ff" : settings.dusk ? "#17283cff" : "#8aa1a8ff");
        scene.fogColor = Color3.FromHexString(cave ? "#303b52" : settings.dusk ? "#5f7184" : "#8aa1a8");
        scene.ambientColor = Color3.FromHexString(settings.dusk || cave ? "#263653" : "#6c7f80");
        scene.fogDensity = settings.effects ? maps[settings.mapId].environment?.fogDensity ?? .008 : 0;
        scene.shadowsEnabled = settings.shadows;
        pipeline.bloomEnabled = settings.effects;
        pipeline.bloomThreshold = .78;
        pipeline.bloomWeight = .2;
        pipeline.bloomKernel = settings.lightweight ? 24 : 40;
        pipeline.samples = settings.lightweight ? 1 : 2;
        pipeline.fxaaEnabled = !settings.lightweight;
        scene.imageProcessingConfiguration.contrast = settings.effects ? 1.12 : 1;
        scene.imageProcessingConfiguration.exposure = settings.dusk ? .92 : 1.02;
        scene.imageProcessingConfiguration.vignetteEnabled = settings.effects;
        scene.imageProcessingConfiguration.vignetteWeight = 1.4;
        scene.imageProcessingConfiguration.vignetteColor = Color4.FromHexString(settings.dusk ? "#10182bff" : "#2b3c40ff");
        shadows?.setDarkness(settings.dusk ? .46 : .32);
    };
    const rebuild = () => {
        cancelBenchmark("マップまたは描画条件が変わりました");
        actor?.dispose();
        world?.dispose();
        world = page === "characters"
            ? createWalkCourseWorld(scene)
            : createWorld(scene, maps[settings.mapId], settings.lightweight);
        controller = createCharacterController(world.walk);
        actor = createCharacterFixture(scene, world.walk);
        actor.root.position.set(controller.state.x, controller.state.y, controller.state.z);
        animationSeconds = 0;
        pointerTarget = undefined;
        const renderRatio = settings.lightweight ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
        engine.setHardwareScalingLevel(1 / renderRatio);
        engine.resize();
        shadows?.dispose();
        shadows = new ShadowGenerator(settings.lightweight ? 512 : 1024, sun);
        shadows.useBlurExponentialShadowMap = !settings.lightweight;
        shadows.blurKernel = settings.lightweight ? 4 : 12;
        for (const mesh of world.shadowCasters)
            shadows.addShadowCaster(mesh, false);
        applyCamera();
        applyRendering();
        syncUi();
    };
    const finishBenchmark = () => {
        if (!benchmark || report)
            return;
        const percentiles = benchmarkPercentiles(benchmark);
        if (!percentiles)
            return;
        const notices = byId<HTMLElement>("third-party-notices");
        const orientation = canvas.clientWidth >= canvas.clientHeight ? "landscape" : "portrait";
        const quality = settings.lightweight ? "light" : "standard";
        report = {
            metadata: {
                mapId: settings.mapId,
                preset: `${settings.mapId}-${quality}-${orientation}`,
                presetVersion: BENCHMARK_PRESET_VERSION,
                schemaVersion: BENCHMARK_SCHEMA_VERSION,
                contentId: notices.dataset.buildId,
                buildId: notices.dataset.buildId,
                htmlBytes: Number(notices.dataset.htmlBytes),
            },
            viewport: {
                css: [canvas.clientWidth, canvas.clientHeight],
                render: [engine.getRenderWidth(), engine.getRenderHeight()],
                dpr: devicePixelRatio,
                quality,
            },
            settings: { ...settings },
            camera: {
                alpha: camera.alpha,
                beta: camera.beta,
                target: camera.target.asArray(),
                ortho: [camera.orthoLeft, camera.orthoRight, camera.orthoTop, camera.orthoBottom],
            },
            time: { animation: "paused-static", seconds: animationSeconds },
            ...percentiles,
            drawCalls: instrumentation.drawCallsCounter.current,
            activeMeshes: scene.getActiveMeshes().length,
            triangles: scene.getActiveIndices() / 3,
            note: "CPU scene.render wall time and frame intervals; no GPU timing or automatic art score.",
        };
        summary.textContent = `完了: ${percentiles.sampleCount} samples / interval p95 ${percentiles.frameIntervalMs.p95?.toFixed(1)} ms / CPU p95 ${percentiles.cpuSceneRenderMs.p95?.toFixed(1)} ms`;
        byId<HTMLButtonElement>("export-report").disabled = false;
    };
    const startBenchmark = () => {
        if (page === "characters")
            return;
        const mapId = settings.mapId;
        const lightweight = settings.lightweight;
        cancelBenchmark("新しい計測を開始しました");
        settings = { ...benchmarkPreset(), mapId, lightweight, paused: true };
        report = undefined;
        byId<HTMLButtonElement>("export-report").disabled = true;
        rebuild();
        benchmark = beginBenchmark(conditionKey());
        summary.textContent = "シェーダー準備中…";
        scene.executeWhenReady(() => {
            if (!benchmark || benchmark.phase !== "waiting-ready" || conditionKey() !== benchmark.conditionKey || document.hidden) {
                if (benchmark)
                    abortBenchmark(benchmark, "準備中に条件が変わりました");
                return;
            }
            markBenchmarkReady(benchmark, performance.now());
            summary.textContent = "ウォームアップ 2秒…";
        });
    };
    try {
        if (!Engine.isSupported())
            throw new Error("WebGL unavailable");
        engine = new Engine(canvas, true, { adaptToDeviceRatio: false, stencil: true }, false);
        scene = new Scene(engine);
        scene.useRightHandedSystem = true;
        scene.fogMode = Scene.FOGMODE_EXP2;
        camera = new ArcRotateCamera("camera", -Math.PI / 4, 1.02, 30, Vector3.Zero(), scene);
        camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
        camera.inputs.clear();
        camera.minZ = .2;
        camera.maxZ = 100;
        sun = new DirectionalLight("sun", new Vector3(-.48, -1, .3), scene);
        sun.position.set(12, 22, -15);
        sky = new HemisphericLight("sky", Vector3.Up(), scene);
        pipeline = new DefaultRenderingPipeline("world-effects", false, scene, [camera]);
        instrumentation = new SceneInstrumentation(scene);
        rebuild();
        engine.runRenderLoop(() => {
            if (canvas.clientWidth < 32 || canvas.clientHeight < 32) {
                cancelBenchmark("表示領域が小さすぎます");
                return;
            }
            if (document.hidden)
                return;
            const now = performance.now();
            const interval = now - previous;
            const delta = Math.min(.1, Math.max(0, interval / 1000));
            previous = now;
            if (!settings.paused)
                animationSeconds += delta;
            if (page === "characters" && controller && actor) {
                const side = Number(keys.has("ArrowRight") || keys.has("d")) - Number(keys.has("ArrowLeft") || keys.has("a"));
                const forward = Number(keys.has("ArrowUp") || keys.has("w")) - Number(keys.has("ArrowDown") || keys.has("s"));
                if (side || forward) {
                    pointerTarget = undefined;
                    const length = Math.hypot(side, forward);
                    const cameraForward = camera.target.subtract(camera.position);
                    cameraForward.y = 0;
                    cameraForward.normalize();
                    const cameraRight = new Vector3(-cameraForward.z, 0, cameraForward.x);
                    const movement = cameraForward.scale(forward / length).add(cameraRight.scale(side / length)).scale(delta * 3.1);
                    controller.moveBy(movement.x, movement.z);
                    actor.root.position.set(controller.state.x, controller.state.y, controller.state.z);
                }
                else if (pointerTarget) {
                    controller.moveToward(pointerTarget.x, pointerTarget.z, delta * 3.1);
                    actor.root.position.set(controller.state.x, controller.state.y, controller.state.z);
                    if (Math.hypot(pointerTarget.x - controller.state.x, pointerTarget.z - controller.state.z) < .08)
                        pointerTarget = undefined;
                }
            }
            world.update(animationSeconds);
            const before = performance.now();
            scene.render();
            const cpu = performance.now() - before;
            if (benchmark) {
                captureBenchmark(benchmark, { conditionKey: conditionKey(), now, intervalMs: interval, cpuSceneRenderMs: cpu });
                if (benchmark.phase === "measure")
                    summary.textContent = "10秒計測中…";
                if (benchmark.phase === "complete")
                    finishBenchmark();
            }
            fpsFrames += 1;
            if (now - fpsAt >= 1000) {
                live.textContent = `${Math.round(fpsFrames * 1000 / (now - fpsAt))} FPS`;
                fpsAt = now;
                fpsFrames = 0;
            }
        });
        addEventListener("resize", () => {
            cancelBenchmark("画面サイズが変わりました");
            engine.resize();
            applyCamera();
        });
        addEventListener("blur", () => keys.clear());
        document.addEventListener("visibilitychange", () => { keys.clear(); if (document.hidden)
            cancelBenchmark("タブが非表示です"); });
        addEventListener("keydown", (event) => keys.add(event.key));
        addEventListener("keyup", (event) => keys.delete(event.key));
        canvas.addEventListener("pointerdown", (event) => {
            if (page !== "characters" || !controller || !actor)
                return;
            const rect = canvas.getBoundingClientRect();
            const ray = scene.createPickingRay(event.clientX - rect.left, event.clientY - rect.top, null, camera);
            const plane = Plane.FromPositionAndNormal(new Vector3(0, controller.state.y, 0), Vector3.Up());
            const distance = ray.intersectsPlane(plane);
            if (distance === null)
                return;
            const point = ray.origin.add(ray.direction.scale(distance));
            pointerTarget = { x: point.x, z: point.z };
        });
        document.querySelectorAll<HTMLButtonElement>("[data-map]").forEach((button) => button.onclick = () => {
            settings.mapId = button.dataset.map as MapId;
            rebuild();
        });
        byId<HTMLInputElement>("zoom").oninput = (event) => {
            cancelBenchmark("カメラが変わりました");
            settings.zoom = Number((event.target as HTMLInputElement).value);
            applyCamera();
        };
        byId<HTMLInputElement>("yaw").oninput = (event) => {
            cancelBenchmark("カメラが変わりました");
            settings.yaw = Number((event.target as HTMLInputElement).value);
            applyCamera();
        };
        document.querySelectorAll<HTMLInputElement>("[data-setting]").forEach((input) => input.onchange = () => {
            cancelBenchmark("設定が変わりました");
            const key = input.dataset.setting as keyof ViewerSettings;
            (settings as unknown as Record<string, boolean>)[key] = input.checked;
            if (key === "lightweight")
                rebuild();
            else
                applyRendering();
            syncUi();
        });
        byId<HTMLButtonElement>("reset").onclick = () => { settings = { ...defaultSettings, mapId: settings.mapId }; rebuild(); };
        byId<HTMLButtonElement>("save").onclick = () => download(new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }), "hd2d-settings.json");
        byId<HTMLInputElement>("restore").onchange = async (event) => { try {
            const file = (event.target as HTMLInputElement).files?.[0];
            const restored = file && normalizeSettings(JSON.parse(await file.text()));
            if (!restored)
                throw new Error("invalid settings");
            settings = restored;
            rebuild();
            setStatus("設定を復元しました");
        }
        catch {
            setStatus("設定JSONの形式が違います", true);
        } };
        byId<HTMLButtonElement>("benchmark").onclick = startBenchmark;
        byId<HTMLButtonElement>("export-report").onclick = () => report && download(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "hd2d-benchmark.json");
        const captureButton = byId<HTMLButtonElement>("capture-png");
        captureButton.disabled = false;
        captureButton.onclick = async () => {
            captureButton.disabled = true;
            try {
                const image = await CreateScreenshotUsingRenderTargetAsync(engine, camera, {
                    width: engine.getRenderWidth(),
                    height: engine.getRenderHeight(),
                }, "image/png");
                downloadUrl(image, "hd2d-scene.png");
            }
            finally {
                captureButton.disabled = false;
            }
        };
        byId<HTMLButtonElement>("toggle-controls").onclick = () => controls.classList.toggle("collapsed");
        if (page === "characters") {
            byId<HTMLButtonElement>("benchmark").disabled = true;
            summary.textContent = "人物操作ページは固定6条件ではないため計測対象外です";
            document.querySelector(".map-buttons")?.remove();
        }
        if (matchMedia("(max-width:620px)").matches)
            controls.classList.add("collapsed");
        document.querySelector(".notice")?.remove();
        setStatus(page === "characters" ? "準備完了 · 固定歩行コース" : `準備完了 · ${maps[settings.mapId].name}`);
    }
    catch (error) {
        console.error(error);
        setStatus("読込に失敗しました。WebGL の設定を確認してください", true);
    }
}
