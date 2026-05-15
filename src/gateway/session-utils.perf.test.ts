import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import * as thinking from "../auto-reply/thinking.js";
import type { KovaConfig } from "../config/config.js";
import type { SessionEntry } from "../config/sessions.js";
import { createEmptyPluginRegistry } from "../plugins/registry-empty.js";
import { resetPluginRuntimeStateForTest, setActivePluginRegistry } from "../plugins/runtime.js";
import { withStateDirEnv } from "../test-helpers/state-dir-env.js";
import * as usageFormat from "../utils/usage-format.js";
import { listSessionsFromStore } from "./session-utils.js";

describe("listSessionsFromStore resolver cache", () => {
  test("collapses per-row resolver work to unique provider/model tuples", async () => {
    await withStateDirEnv("kova-session-list-cache-", async ({ stateDir }) => {
      resetPluginRuntimeStateForTest();
      setActivePluginRegistry(createEmptyPluginRegistry());
      const cfg = {
        agents: {
          defaults: { model: { primary: "openrouter/openrouter/auto" } },
        },
      } as KovaConfig;
      const tuples: Array<{ modelProvider: string; model: string }> = [
        { modelProvider: "openrouter", model: "openrouter/auto" },
        { modelProvider: "openai", model: "gpt-5" },
        { modelProvider: "anthropic", model: "claude-opus-4-7" },
        { modelProvider: "google", model: "gemini-2.5-pro" },
        { modelProvider: "ollama", model: "llama3.2" },
      ];

      const store: Record<string, SessionEntry> = {};
      const now = Date.now();
      const rowCount = 30;
      for (let i = 0; i < rowCount; i++) {
        const tuple = tuples[i % tuples.length];
        store[`agent:default:webchat:dm:${i}`] = {
          updatedAt: now - i,
          modelProvider: tuple.modelProvider,
          model: tuple.model,
          inputTokens: 100,
          outputTokens: 50,
        } as SessionEntry;
      }

      const thinkingSpy = vi.spyOn(thinking, "listThinkingLevelOptions");
      const costSpy = vi.spyOn(usageFormat, "resolveModelCostConfig");
      try {
        const result = listSessionsFromStore({
          cfg,
          storePath: path.join(stateDir, "sessions.json"),
          store,
          opts: { limit: rowCount },
        });

        expect(result.sessions.length).toBe(rowCount);
        expect(thinkingSpy.mock.calls.length).toBeLessThanOrEqual(tuples.length + 1);
        expect(costSpy.mock.calls.length).toBeLessThanOrEqual(tuples.length);
      } finally {
        thinkingSpy.mockRestore();
        costSpy.mockRestore();
      }
    });
  });
});
