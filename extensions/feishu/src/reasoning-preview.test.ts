import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveFeishuReasoningPreviewEnabled } from "./reasoning-preview.js";

const { loadSessionStoreMock } = vi.hoisted(() => ({
  loadSessionStoreMock: vi.fn(),
}));

vi.mock("./bot-runtime-api.js", async () => {
  const actual =
    await vi.importActual<typeof import("./bot-runtime-api.js")>("./bot-runtime-api.js");
  return {
    ...actual,
    loadSessionStore: loadSessionStoreMock,
  };
});

describe("resolveFeishuReasoningPreviewEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables previews only for stream reasoning sessions", () => {
    loadSessionStoreMock.mockReturnValue({
      "agent:main:feishu:dm:ou_sender_1": { reasoningLevel: "stream" },
      "agent:main:feishu:dm:ou_sender_2": { reasoningLevel: "on" },
    });

    expect(
      resolveFeishuReasoningPreviewEnabled({
        cfg: {},
        agentId: "main",
        storePath: "/tmp/feishu-sessions.json",
        sessionKey: "agent:main:feishu:dm:ou_sender_1",
      }),
    ).toBe(true);
    expect(
      resolveFeishuReasoningPreviewEnabled({
        cfg: {},
        agentId: "main",
        storePath: "/tmp/feishu-sessions.json",
        sessionKey: "agent:main:feishu:dm:ou_sender_2",
      }),
    ).toBe(false);
  });

  it("returns false for missing sessions or load failures", () => {
    loadSessionStoreMock.mockImplementationOnce(() => {
      throw new Error("disk unavailable");
    });

    expect(
      resolveFeishuReasoningPreviewEnabled({
        cfg: {},
        agentId: "main",
        storePath: "/tmp/feishu-sessions.json",
        sessionKey: "agent:main:feishu:dm:ou_sender_1",
      }),
    ).toBe(false);
    expect(
      resolveFeishuReasoningPreviewEnabled({
        cfg: {},
        agentId: "main",
        storePath: "/tmp/feishu-sessions.json",
      }),
    ).toBe(false);
  });

  it("uses configured defaults when a session does not override reasoning", () => {
    loadSessionStoreMock.mockReturnValue({});

    expect(
      resolveFeishuReasoningPreviewEnabled({
        cfg: {
          agents: {
            defaults: { reasoningDefault: "off" },
            list: [{ id: "Ops", reasoningDefault: "stream" }],
          },
        },
        agentId: "ops",
        storePath: "/tmp/feishu-sessions.json",
        sessionKey: "agent:ops:feishu:dm:ou_sender_1",
      }),
    ).toBe(true);
    expect(
      resolveFeishuReasoningPreviewEnabled({
        cfg: {
          agents: {
            defaults: { reasoningDefault: "stream" },
            list: [{ id: "Ops", reasoningDefault: "off" }],
          },
        },
        agentId: "ops",
        storePath: "/tmp/feishu-sessions.json",
      }),
    ).toBe(false);
  });
});
