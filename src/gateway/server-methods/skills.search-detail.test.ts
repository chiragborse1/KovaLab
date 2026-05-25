import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/config.js", () => ({
  getRuntimeConfig: vi.fn(() => ({})),
  writeConfigFile: vi.fn(),
}));

vi.mock("../../agents/agent-scope.js", () => ({
  listAgentIds: vi.fn(() => ["main"]),
  resolveDefaultAgentId: vi.fn(() => "main"),
  resolveAgentWorkspaceDir: vi.fn(() => "/tmp/workspace"),
}));

vi.mock("../../agents/skills-install.js", () => ({
  installSkill: vi.fn(),
}));

const { skillsHandlers } = await import("./skills.js");

function callHandler(method: string, params: Record<string, unknown>) {
  let ok: boolean | null = null;
  let response: unknown;
  let error: unknown;
  const result = skillsHandlers[method]({
    params,
    req: {} as never,
    client: null as never,
    isWebchatConnect: () => false,
    context: {} as never,
    respond: (success: boolean, res: unknown, err: unknown) => {
      ok = success;
      response = res;
      error = err;
    },
  });
  return Promise.resolve(result).then(() => ({ ok, response, error }));
}

describe("skills.search handler", () => {
  beforeEach(() => {});

  it("reports registry search as unavailable", async () => {
    const { ok, response, error } = await callHandler("skills.search", {
      query: "github",
      limit: 10,
    });

    expect(ok).toBe(false);
    expect(response).toBeUndefined();
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      message: expect.stringContaining("registry integration is not available"),
    });
  });

  it("rejects limit below minimum", async () => {
    const { ok, error } = await callHandler("skills.search", {
      query: "test",
      limit: 0,
    });

    expect(ok).toBe(false);
    expect(error).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("rejects limit above maximum", async () => {
    const { ok, error } = await callHandler("skills.search", {
      query: "test",
      limit: 101,
    });

    expect(ok).toBe(false);
    expect(error).toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("skills.detail handler", () => {
  it("reports registry detail as unavailable", async () => {
    const { ok, response, error } = await callHandler("skills.detail", {
      slug: "github",
    });

    expect(ok).toBe(false);
    expect(response).toBeUndefined();
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      message: expect.stringContaining("registry integration is not available"),
    });
  });

  it("rejects missing slug", async () => {
    const { ok, error } = await callHandler("skills.detail", {});

    expect(ok).toBe(false);
    expect(error).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("rejects empty slug", async () => {
    const { ok, error } = await callHandler("skills.detail", { slug: "" });

    expect(ok).toBe(false);
    expect(error).toMatchObject({ code: "INVALID_REQUEST" });
  });
});
