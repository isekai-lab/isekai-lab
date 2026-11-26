import { defaultSettings, validSettings, type ViewerSettings } from "../contracts/index.ts";

export function normalizeSettings(input: unknown): ViewerSettings | undefined {
  return validSettings(input) ? { ...input } : undefined;
}

export const benchmarkPreset = (): ViewerSettings => ({ ...defaultSettings, yaw: 0, paused: false });
