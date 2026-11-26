export const BENCHMARK_SCHEMA_VERSION = 1;
export const BENCHMARK_PRESET_VERSION = 1;
export const WARMUP_MS = 2_000;
export const MEASURE_MS = 10_000;

export type BenchmarkState = {
  conditionKey: string;
  phase: "waiting-ready" | "warmup" | "measure" | "complete" | "aborted";
  phaseStartedAt?: number;
  intervals: number[];
  cpuTimes: number[];
  abortReason?: string;
};

export const percentile = (values: readonly number[], fraction: number): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
};

export const beginBenchmark = (conditionKey: string): BenchmarkState => ({
  conditionKey,
  phase: "waiting-ready",
  intervals: [],
  cpuTimes: [],
});

export function markBenchmarkReady(state: BenchmarkState, now: number): void {
  if (state.phase === "waiting-ready") {
    state.phase = "warmup";
    state.phaseStartedAt = now;
  }
}

export function abortBenchmark(state: BenchmarkState, reason: string): void {
  if (state.phase !== "complete" && state.phase !== "aborted") {
    state.phase = "aborted";
    state.abortReason = reason;
  }
}

export function captureBenchmark(
  state: BenchmarkState,
  capture: Readonly<{ conditionKey: string; now: number; intervalMs: number; cpuSceneRenderMs: number }>,
): void {
  if (capture.conditionKey !== state.conditionKey) return abortBenchmark(state, "condition-changed");
  if (state.phase === "waiting-ready" || state.phase === "complete" || state.phase === "aborted") return;
  const elapsed = capture.now - (state.phaseStartedAt ?? capture.now);
  if (state.phase === "warmup") {
    if (elapsed >= WARMUP_MS) {
      state.phase = "measure";
      state.phaseStartedAt = capture.now;
    }
    return;
  }
  if (elapsed >= MEASURE_MS) {
    state.phase = "complete";
    return;
  }
  if (Number.isFinite(capture.intervalMs) && Number.isFinite(capture.cpuSceneRenderMs)) {
    state.intervals.push(capture.intervalMs);
    state.cpuTimes.push(capture.cpuSceneRenderMs);
  }
}

export function benchmarkPercentiles(state: BenchmarkState) {
  if (state.phase !== "complete" || !state.intervals.length || !state.cpuTimes.length) return undefined;
  return {
    sampleCount: state.intervals.length,
    frameIntervalMs: { p50: percentile(state.intervals, .5), p95: percentile(state.intervals, .95) },
    cpuSceneRenderMs: { p50: percentile(state.cpuTimes, .5), p95: percentile(state.cpuTimes, .95) },
  };
}
