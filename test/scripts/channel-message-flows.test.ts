import { describe, expect, it, vi } from "vitest";
import {
  parseChannelMessageFlowArgs,
  resolveTelegramFlowThreadSpec,
  runTelegramThinkingFinalFlow,
  runTelegramWorkingFinalFlow,
} from "../../scripts/dev/channel-message-flows.ts";
import type { KovaConfig } from "../../src/config/types.kova.js";

describe("channel message flows dev runner", () => {
  it("parses the Telegram thinking-final flow from channel/target flags", () => {
    const parsed = parseChannelMessageFlowArgs([
      "--channel",
      "telegram",
      "--target",
      "123",
      "--flow",
      "thinking-final",
      "--account",
      "sut",
      "--thread-id",
      "42",
      "--delay-ms",
      "0",
    ]);

    expect(parsed).toEqual({
      accountId: "sut",
      channel: "telegram",
      delayMs: 0,
      flow: "thinking-final",
      target: "123",
      threadId: 42,
    });
  });

  it("parses the Telegram working-final flow from channel/chat flags", () => {
    const parsed = parseChannelMessageFlowArgs([
      "--channel",
      "telegram",
      "--chat",
      "123",
      "--flow",
      "working-final",
      "--duration-ms",
      "12000",
      "--delay-ms",
      "0",
    ]);

    expect(parsed).toEqual({
      channel: "telegram",
      delayMs: 0,
      durationMs: 12000,
      flow: "working-final",
      target: "123",
    });
  });

  it("streams thinking updates, clears the preview, then sends the final answer", async () => {
    const events: string[] = [];
    const stream = {
      update: vi.fn((text: string) => {
        events.push(`update:${text}`);
      }),
      flush: vi.fn(async () => {
        events.push("flush");
      }),
      clear: vi.fn(async () => {
        events.push("clear");
      }),
      stop: vi.fn(async () => {}),
      messageId: vi.fn(() => 17),
      forceNewMessage: vi.fn(),
    };
    const sendFinal = vi.fn(async () => {
      events.push("final");
      return { messageId: "99", chatId: "123" };
    });

    const result = await runTelegramThinkingFinalFlow(
      {
        cfg: {} as KovaConfig,
        delayMs: 0,
        target: "123",
        thinkingUpdates: ["Checking the request.", "Reading the Telegram code.", "Ready."],
      },
      {
        createDraftStream: vi.fn(() => stream),
        sendFinal,
        sleep: vi.fn(async () => {}),
      },
    );

    expect(stream.update).toHaveBeenCalledTimes(3);
    expect(stream.update.mock.calls[0]?.[0]).toContain("Thinking");
    expect(stream.update.mock.calls[0]?.[0]).toContain("_Checking the request._");
    expect(events.at(-2)).toBe("clear");
    expect(events.at(-1)).toBe("final");
    expect(sendFinal).toHaveBeenCalledWith({
      accountId: undefined,
      cfg: {},
      target: "123",
      text: "Final answer: the Telegram thinking preview cleared and this durable reply landed.",
      threadId: undefined,
    });
    expect(result).toEqual({ finalMessageId: "99", previewUpdates: 3 });
  });

  it("streams working updates before the final answer", async () => {
    const stream = {
      update: vi.fn(),
      flush: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      messageId: vi.fn(() => 17),
      forceNewMessage: vi.fn(),
    };
    const sendFinal = vi.fn(async () => ({ messageId: "100", chatId: "123" }));

    const result = await runTelegramWorkingFinalFlow(
      {
        cfg: {} as KovaConfig,
        delayMs: 0,
        durationMs: 12_000,
        target: "123",
      },
      {
        createDraftStream: vi.fn(() => stream),
        sendFinal,
        sleep: vi.fn(async () => {}),
      },
    );

    expect(stream.update).toHaveBeenNthCalledWith(1, "Working\n\n🛠️ checking gateway state");
    expect(stream.update.mock.calls.at(-1)?.[0]).toContain("🧪 confirming durable final delivery");
    expect(stream.clear).toHaveBeenCalledBefore(sendFinal);
    expect(sendFinal).toHaveBeenCalledWith({
      accountId: undefined,
      cfg: {},
      target: "123",
      text: "Final answer: the Telegram working preview cleared and this durable reply landed.",
      threadId: undefined,
    });
    expect(result).toEqual({ finalMessageId: "100", previewUpdates: 5 });
  });

  it("uses two second progress update cadence by default", async () => {
    const stream = {
      update: vi.fn(),
      flush: vi.fn(async () => {}),
      clear: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      messageId: vi.fn(() => 17),
      forceNewMessage: vi.fn(),
    };
    const sleep = vi.fn(async () => {});

    const result = await runTelegramWorkingFinalFlow(
      {
        cfg: {} as KovaConfig,
        durationMs: 20_000,
        target: "123",
      },
      {
        createDraftStream: vi.fn(() => stream),
        sendFinal: vi.fn(async () => ({ messageId: "101", chatId: "123" })),
        sleep,
      },
    );

    expect(sleep).toHaveBeenCalledTimes(9);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(result.previewUpdates).toBe(5);
  });

  it("maps flow thread ids to Telegram forum topic specs", () => {
    expect(resolveTelegramFlowThreadSpec(42)).toEqual({ id: 42, scope: "forum" });
    expect(resolveTelegramFlowThreadSpec()).toBeUndefined();
  });
});
