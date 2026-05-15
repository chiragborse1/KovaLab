import type { KovaConfig } from "../../config/types.kova.js";

export function makeModelFallbackCfg(overrides: Partial<KovaConfig> = {}): KovaConfig {
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-4.1-mini",
          fallbacks: ["anthropic/claude-haiku-3-5"],
        },
      },
    },
    ...overrides,
  } as KovaConfig;
}
