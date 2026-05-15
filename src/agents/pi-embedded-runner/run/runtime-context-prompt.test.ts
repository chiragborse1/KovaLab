import { describe, expect, it, vi } from "vitest";
import {
  buildCurrentTurnPromptContextSuffix,
  queueRuntimeContextForNextTurn,
  resolveRuntimeContextPromptParts,
} from "./runtime-context-prompt.js";

describe("runtime context prompt submission", () => {
  it("keeps unchanged prompts as a normal user prompt", () => {
    expect(
      resolveRuntimeContextPromptParts({
        effectivePrompt: "visible ask",
        transcriptPrompt: "visible ask",
      }),
    ).toEqual({ prompt: "visible ask" });
  });

  it("moves hidden runtime context out of the visible prompt", () => {
    const effectivePrompt = [
      "visible ask",
      "",
      "<<<BEGIN_KOVA_INTERNAL_CONTEXT>>>",
      "secret runtime context",
      "<<<END_KOVA_INTERNAL_CONTEXT>>>",
    ].join("\n");

    expect(
      resolveRuntimeContextPromptParts({
        effectivePrompt,
        transcriptPrompt: "visible ask",
      }),
    ).toEqual({
      prompt: "visible ask",
      runtimeContext:
        "<<<BEGIN_KOVA_INTERNAL_CONTEXT>>>\nsecret runtime context\n<<<END_KOVA_INTERNAL_CONTEXT>>>",
    });
  });

  it("preserves prompt additions as hidden runtime context", () => {
    expect(
      resolveRuntimeContextPromptParts({
        effectivePrompt: ["runtime prefix", "", "visible ask", "", "retry instruction"].join("\n"),
        transcriptPrompt: "visible ask",
      }),
    ).toEqual({
      prompt: "visible ask",
      runtimeContext: "runtime prefix\n\nretry instruction",
    });
  });

  it("uses a marker prompt for runtime-only events", () => {
    expect(
      resolveRuntimeContextPromptParts({
        effectivePrompt: "internal event",
        transcriptPrompt: "",
      }),
    ).toEqual({
      prompt: "",
      runtimeContext: "internal event",
      runtimeOnly: true,
      runtimeSystemContext: expect.stringContaining("internal event"),
    });
  });

  it("queues runtime context as a hidden next-turn custom message", async () => {
    const sendCustomMessage = vi.fn(async () => {});

    await queueRuntimeContextForNextTurn({
      session: { sendCustomMessage },
      runtimeContext: "secret runtime context",
    });

    expect(sendCustomMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: "kova.runtime-context",
        content: expect.stringContaining("secret runtime context"),
        display: false,
      }),
      { deliverAs: "nextTurn" },
    );
  });

  it("formats reply chains as current-turn untrusted prompt context", () => {
    const suffix = buildCurrentTurnPromptContextSuffix({
      replyChain: [
        {
          messageId: "34098",
          sender: "obviyus",
          body: "r u back from hermes",
          replyToId: "34090",
        },
        {
          messageId: "34090",
          sender: "Kesava",
          mediaType: "image/png",
          mediaRef: "telegram:file/photo-1",
        },
      ],
    });

    expect(suffix).toContain("Reply chain of current user message");
    expect(suffix).toContain('"message_id": "34098"');
    expect(suffix).toContain('"reply_to_id": "34090"');
    expect(suffix).toContain('"media_ref": "telegram:file/photo-1"');
  });

  it("labels runtime-only events as system context", async () => {
    const { buildRuntimeEventSystemContext } = await import("./runtime-context-prompt.js");

    expect(buildRuntimeEventSystemContext("internal event")).toContain("Kova runtime event.");
    expect(buildRuntimeEventSystemContext("internal event")).toContain("not user-authored");
  });
});
