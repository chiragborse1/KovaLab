import { describe, expect, it } from "vitest";
import { STREAM_ERROR_FALLBACK_TEXT } from "../agents/stream-message-shared.js";
import { projectRecentChatDisplayMessages } from "./chat-display-projection.js";

describe("projectRecentChatDisplayMessages", () => {
  it("hides internal assistant failure stubs from display history", () => {
    const result = projectRecentChatDisplayMessages([
      { role: "user", content: "hello", timestamp: 1 },
      {
        role: "assistant",
        content: [{ type: "text", text: STREAM_ERROR_FALLBACK_TEXT }],
        stopReason: "error",
        errorMessage: "429 rate limit",
        timestamp: 2,
      },
      { role: "assistant", content: "final answer", timestamp: 3 },
    ]);

    expect(result).toEqual([
      { role: "user", content: "hello", timestamp: 1 },
      { role: "assistant", content: "final answer", timestamp: 3 },
    ]);
  });

  it("keeps normal assistant error text visible", () => {
    const result = projectRecentChatDisplayMessages([
      {
        role: "assistant",
        content: "The provider returned a retryable error.",
        stopReason: "error",
        timestamp: 1,
      },
    ]);

    expect(result).toEqual([
      {
        role: "assistant",
        content: "The provider returned a retryable error.",
        stopReason: "error",
        timestamp: 1,
      },
    ]);
  });
});
