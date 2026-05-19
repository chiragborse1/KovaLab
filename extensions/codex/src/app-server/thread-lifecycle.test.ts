import type { EmbeddedRunAttemptParams } from "getkova/plugin-sdk/agent-harness-runtime";
import { describe, expect, it } from "vitest";
import { buildDeveloperInstructions, resolveReasoningEffort } from "./thread-lifecycle.js";

function createAttemptParams(
  overrides: Partial<EmbeddedRunAttemptParams> = {},
): EmbeddedRunAttemptParams {
  return {
    provider: "openai",
    modelId: "gpt-5.5",
    sessionId: "s1",
    sessionFile: "/tmp/kova-session.jsonl",
    workspaceDir: "/tmp/kova-workspace",
    prompt: "hello",
    runId: "run1",
    ...overrides,
  } as EmbeddedRunAttemptParams;
}

describe("Codex app-server developer instructions", () => {
  it("summarizes deferred dynamic tool names in developer instructions", () => {
    const instructions = buildDeveloperInstructions(createAttemptParams(), {
      dynamicTools: [
        {
          name: "message",
          description: "Send a message",
          inputSchema: { type: "object" },
        },
        {
          name: "music_generate",
          description: "Create music",
          inputSchema: { type: "object" },
          namespace: "kova",
          deferLoading: true,
        },
        {
          name: "image_generate",
          description: "Create images",
          inputSchema: { type: "object" },
          namespace: "kova",
          deferLoading: true,
        },
      ],
    });

    expect(instructions).toContain(
      "Deferred searchable Kova dynamic tools available: image_generate, music_generate.",
    );
    expect(instructions).toContain("Use `tool_search` to load exact callable specs before use.");
    expect(instructions).not.toContain("message,");
  });

  it("keeps developer instructions compact when no dynamic tools are deferred", () => {
    const instructions = buildDeveloperInstructions(createAttemptParams(), {
      dynamicTools: [
        {
          name: "message",
          description: "Send a message",
          inputSchema: { type: "object" },
        },
      ],
    });

    expect(instructions).not.toContain("Deferred searchable Kova dynamic tools available");
  });
});

describe("resolveReasoningEffort (#71946)", () => {
  describe("modern Codex models (none/low/medium/high/xhigh enum)", () => {
    it.each(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.2"] as const)(
      "translates 'minimal' -> 'low' for %s so the first request is accepted",
      (modelId) => {
        expect(resolveReasoningEffort("minimal", modelId)).toBe("low");
      },
    );

    it.each(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.2"] as const)(
      "passes 'low' / 'medium' / 'high' / 'xhigh' through unchanged for %s",
      (modelId) => {
        expect(resolveReasoningEffort("low", modelId)).toBe("low");
        expect(resolveReasoningEffort("medium", modelId)).toBe("medium");
        expect(resolveReasoningEffort("high", modelId)).toBe("high");
        expect(resolveReasoningEffort("xhigh", modelId)).toBe("xhigh");
      },
    );

    it("normalizes case-variant model ids", () => {
      expect(resolveReasoningEffort("minimal", "GPT-5.5")).toBe("low");
      expect(resolveReasoningEffort("minimal", " gpt-5.4-mini ")).toBe("low");
    });
  });

  describe("legacy / non-modern Codex models", () => {
    it.each(["gpt-5", "gpt-4o", "o3-mini", "codex-mini-latest"] as const)(
      "preserves 'minimal' for %s — pre-modern enum still supports it",
      (modelId) => {
        expect(resolveReasoningEffort("minimal", modelId)).toBe("minimal");
      },
    );

    it("preserves 'minimal' for empty / unknown model ids (conservative default)", () => {
      expect(resolveReasoningEffort("minimal", "")).toBe("minimal");
      expect(resolveReasoningEffort("minimal", "unknown-model-xyz")).toBe("minimal");
    });
  });

  describe("non-effort thinkLevel values", () => {
    it("returns null for 'off'", () => {
      expect(resolveReasoningEffort("off", "gpt-5.5")).toBeNull();
      expect(resolveReasoningEffort("off", "gpt-4o")).toBeNull();
    });

    it("returns null for 'adaptive' (non-effort enum value)", () => {
      expect(resolveReasoningEffort("adaptive", "gpt-5.5")).toBeNull();
      expect(resolveReasoningEffort("adaptive", "gpt-4o")).toBeNull();
    });

    it("returns null for 'max' (non-effort enum value)", () => {
      expect(resolveReasoningEffort("max", "gpt-5.5")).toBeNull();
      expect(resolveReasoningEffort("max", "gpt-4o")).toBeNull();
    });
  });
});
