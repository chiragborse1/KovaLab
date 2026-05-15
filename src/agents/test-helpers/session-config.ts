import type { KovaConfig } from "../../config/types.kova.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<KovaConfig["session"]>> = {},
): NonNullable<KovaConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
