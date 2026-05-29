import { describe, expect, it, vi } from "vitest";
import {
  TALK_TEST_PROVIDER_API_KEY_PATH,
  TALK_TEST_PROVIDER_API_KEY_PATH_SEGMENTS,
} from "../../test-utils/talk-test-provider.js";
import { createSecretsHandlers } from "./secrets.js";

async function invokeSecretsReload(params: {
  handlers: ReturnType<typeof createSecretsHandlers>;
  respond: ReturnType<typeof vi.fn>;
}) {
  await params.handlers["secrets.reload"]({
    req: { type: "req", id: "1", method: "secrets.reload" },
    params: {},
    client: null,
    isWebchatConnect: () => false,
    respond: params.respond as unknown as Parameters<
      ReturnType<typeof createSecretsHandlers>["secrets.reload"]
    >[0]["respond"],
    context: {} as never,
  });
}

async function invokeSecretsResolve(params: {
  handlers: ReturnType<typeof createSecretsHandlers>;
  respond: ReturnType<typeof vi.fn>;
  commandName: unknown;
  targetIds: unknown;
  allowedPaths?: unknown;
  forcedActivePaths?: unknown;
  optionalActivePaths?: unknown;
}) {
  await params.handlers["secrets.resolve"]({
    req: { type: "req", id: "1", method: "secrets.resolve" },
    params: {
      commandName: params.commandName,
      targetIds: params.targetIds,
      ...(params.allowedPaths !== undefined ? { allowedPaths: params.allowedPaths } : {}),
      ...(params.forcedActivePaths !== undefined
        ? { forcedActivePaths: params.forcedActivePaths }
        : {}),
      ...(params.optionalActivePaths !== undefined
        ? { optionalActivePaths: params.optionalActivePaths }
        : {}),
    },
    client: null,
    isWebchatConnect: () => false,
    respond: params.respond as unknown as Parameters<
      ReturnType<typeof createSecretsHandlers>["secrets.resolve"]
    >[0]["respond"],
    context: {} as never,
  });
}

describe("secrets handlers", () => {
  function createHandlers(overrides?: {
    reloadSecrets?: () => Promise<{ warningCount: number }>;
    resolveSecrets?: (params: {
      commandName: string;
      targetIds: string[];
      allowedPaths?: string[];
      forcedActivePaths?: string[];
      optionalActivePaths?: string[];
    }) => Promise<{
      assignments: Array<{ path: string; pathSegments: string[]; value: unknown }>;
      diagnostics: string[];
      inactiveRefPaths: string[];
    }>;
  }) {
    const reloadSecrets = overrides?.reloadSecrets ?? (async () => ({ warningCount: 0 }));
    const resolveSecrets =
      overrides?.resolveSecrets ??
      (async () => ({
        assignments: [],
        diagnostics: [],
        inactiveRefPaths: [],
      }));
    return createSecretsHandlers({
      reloadSecrets,
      resolveSecrets,
    });
  }

  it("responds with warning count on successful reload", async () => {
    const handlers = createHandlers({
      reloadSecrets: vi.fn().mockResolvedValue({ warningCount: 2 }),
    });
    const respond = vi.fn();
    await invokeSecretsReload({ handlers, respond });
    expect(respond).toHaveBeenCalledWith(true, { ok: true, warningCount: 2 });
  });

  it("returns unavailable when reload fails", async () => {
    const handlers = createHandlers({
      reloadSecrets: vi.fn().mockRejectedValue(new Error("reload failed")),
    });
    const respond = vi.fn();
    await invokeSecretsReload({ handlers, respond });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        message: "secrets.reload failed",
      }),
    );
  });

  it("resolves requested command secret assignments from the active snapshot", async () => {
    const resolveSecrets = vi.fn().mockResolvedValue({
      assignments: [
        {
          path: TALK_TEST_PROVIDER_API_KEY_PATH,
          pathSegments: [...TALK_TEST_PROVIDER_API_KEY_PATH_SEGMENTS],
          value: "sk",
        },
      ],
      diagnostics: ["note"],
      inactiveRefPaths: [TALK_TEST_PROVIDER_API_KEY_PATH],
    });
    const handlers = createHandlers({ resolveSecrets });
    const respond = vi.fn();
    await invokeSecretsResolve({
      handlers,
      respond,
      commandName: "memory status",
      targetIds: ["talk.providers.*.apiKey"],
    });
    expect(resolveSecrets).toHaveBeenCalledWith({
      commandName: "memory status",
      targetIds: ["talk.providers.*.apiKey"],
    });
    expect(respond).toHaveBeenCalledWith(true, {
      ok: true,
      assignments: [
        {
          path: TALK_TEST_PROVIDER_API_KEY_PATH,
          pathSegments: [...TALK_TEST_PROVIDER_API_KEY_PATH_SEGMENTS],
          value: "sk",
        },
      ],
      diagnostics: ["note"],
      inactiveRefPaths: [TALK_TEST_PROVIDER_API_KEY_PATH],
    });
  });

  it("passes command-scoped secret path options through to the resolver", async () => {
    const resolveSecrets = vi.fn().mockResolvedValue({
      assignments: [],
      diagnostics: [],
      inactiveRefPaths: [],
    });
    const handlers = createHandlers({ resolveSecrets });
    const respond = vi.fn();
    await invokeSecretsResolve({
      handlers,
      respond,
      commandName: "infer web search",
      targetIds: ["plugins.entries.firecrawl.config.webSearch.apiKey"],
      allowedPaths: ["plugins.entries.firecrawl.config.webSearch.apiKey"],
      forcedActivePaths: ["plugins.entries.firecrawl.config.webSearch.apiKey"],
      optionalActivePaths: ["plugins.entries.firecrawl.config.webFetch.apiKey"],
    });

    expect(resolveSecrets).toHaveBeenCalledWith({
      commandName: "infer web search",
      targetIds: ["plugins.entries.firecrawl.config.webSearch.apiKey"],
      allowedPaths: ["plugins.entries.firecrawl.config.webSearch.apiKey"],
      forcedActivePaths: ["plugins.entries.firecrawl.config.webSearch.apiKey"],
      optionalActivePaths: ["plugins.entries.firecrawl.config.webFetch.apiKey"],
    });
    expect(respond).toHaveBeenCalledWith(true, {
      ok: true,
      assignments: [],
      diagnostics: [],
      inactiveRefPaths: [],
    });
  });

  it("rejects invalid secrets.resolve params", async () => {
    const handlers = createHandlers();
    const respond = vi.fn();
    await invokeSecretsResolve({
      handlers,
      respond,
      commandName: "",
      targetIds: "bad",
    });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
      }),
    );
  });

  it("rejects secrets.resolve params when targetIds entries are not strings", async () => {
    const resolveSecrets = vi.fn();
    const handlers = createHandlers({ resolveSecrets });
    const respond = vi.fn();
    await invokeSecretsResolve({
      handlers,
      respond,
      commandName: "memory status",
      targetIds: ["talk.providers.*.apiKey", 12],
    });
    expect(resolveSecrets).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: "invalid secrets.resolve params: targetIds",
      }),
    );
  });

  it("rejects unknown secrets.resolve target ids", async () => {
    const resolveSecrets = vi.fn();
    const handlers = createHandlers({ resolveSecrets });
    const respond = vi.fn();
    await invokeSecretsResolve({
      handlers,
      respond,
      commandName: "memory status",
      targetIds: ["unknown.target"],
    });
    expect(resolveSecrets).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: 'invalid secrets.resolve params: unknown target id "unknown.target"',
      }),
    );
  });

  it("returns unavailable when secrets.resolve handler returns an invalid payload shape", async () => {
    const resolveSecrets = vi.fn().mockResolvedValue({
      assignments: [{ path: TALK_TEST_PROVIDER_API_KEY_PATH, pathSegments: [""], value: "sk" }],
      diagnostics: [],
      inactiveRefPaths: [],
    });
    const handlers = createHandlers({ resolveSecrets });
    const respond = vi.fn();
    await invokeSecretsResolve({
      handlers,
      respond,
      commandName: "memory status",
      targetIds: ["talk.providers.*.apiKey"],
    });
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        message: "secrets.resolve failed",
      }),
    );
  });
});
