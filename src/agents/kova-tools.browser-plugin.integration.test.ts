import { afterEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../config/config.js";
import { activateSecretsRuntimeSnapshot, clearSecretsRuntimeSnapshot } from "../secrets/runtime.js";
import type { AuthProfileStore } from "./auth-profiles.js";
import { resolveKovaPluginToolsForOptions } from "./kova-plugin-tools.js";

const hoisted = vi.hoisted(() => ({
  resolvePluginTools: vi.fn(),
}));

vi.mock("../plugins/tools.js", () => ({
  resolvePluginTools: (...args: unknown[]) => hoisted.resolvePluginTools(...args),
}));

describe("createKovaTools browser plugin integration", () => {
  afterEach(() => {
    hoisted.resolvePluginTools.mockReset();
    clearSecretsRuntimeSnapshot();
  });

  it("keeps the browser tool returned by plugin resolution", () => {
    hoisted.resolvePluginTools.mockReturnValue([
      {
        name: "browser",
        description: "browser fixture tool",
        parameters: {
          type: "object",
          properties: {},
        },
        async execute() {
          return {
            content: [{ type: "text", text: "ok" }],
          };
        },
      },
    ]);

    const config = {
      plugins: {
        allow: ["browser"],
      },
    } as KovaConfig;

    const tools = resolveKovaPluginToolsForOptions({
      options: { config },
      resolvedConfig: config,
    });

    expect(tools.map((tool) => tool.name)).toContain("browser");
  });

  it("omits the browser tool when plugin resolution returns no browser tool", () => {
    hoisted.resolvePluginTools.mockReturnValue([]);

    const config = {
      plugins: {
        allow: ["browser"],
        entries: {
          browser: {
            enabled: false,
          },
        },
      },
    } as KovaConfig;

    const tools = resolveKovaPluginToolsForOptions({
      options: { config },
      resolvedConfig: config,
    });

    expect(tools.map((tool) => tool.name)).not.toContain("browser");
  });

  it("forwards fsPolicy into plugin tool context", async () => {
    let capturedContext: { fsPolicy?: { workspaceOnly: boolean } } | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      const resolvedParams = params as { context?: { fsPolicy?: { workspaceOnly: boolean } } };
      capturedContext = resolvedParams.context;
      return [
        {
          name: "browser",
          description: "browser fixture tool",
          parameters: {
            type: "object",
            properties: {},
          },
          async execute() {
            return {
              content: [{ type: "text", text: "ok" }],
              details: { workspaceOnly: capturedContext?.fsPolicy?.workspaceOnly ?? null },
            };
          },
        },
      ];
    });

    const tools = resolveKovaPluginToolsForOptions({
      options: {
        config: {
          plugins: {
            allow: ["browser"],
          },
        } as KovaConfig,
        fsPolicy: { workspaceOnly: true },
      },
      resolvedConfig: {
        plugins: {
          allow: ["browser"],
        },
      } as KovaConfig,
    });

    const browserTool = tools.find((tool) => tool.name === "browser");
    expect(browserTool).toBeDefined();
    if (!browserTool) {
      throw new Error("expected browser tool");
    }

    const result = await browserTool.execute("tool-call", {});
    const details = (result.details ?? {}) as { workspaceOnly?: boolean | null };
    expect(details.workspaceOnly).toBe(true);
  });

  it("exposes auth profile helpers to plugin tool context", async () => {
    let capturedContext:
      | {
          hasAuthForProvider?: (providerId: string) => boolean;
          resolveApiKeyForProvider?: (providerId: string) => Promise<string | undefined>;
        }
      | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      capturedContext = (
        params as {
          context?: {
            hasAuthForProvider?: (providerId: string) => boolean;
            resolveApiKeyForProvider?: (providerId: string) => Promise<string | undefined>;
          };
        }
      ).context;
      return [];
    });

    const config = {
      plugins: {
        allow: ["browser"],
      },
    } as KovaConfig;

    resolveKovaPluginToolsForOptions({
      options: {
        config,
        authProfileStore: {
          version: 1,
          profiles: {
            "openai:default": {
              type: "api_key",
              provider: "openai",
              key: "sk-test",
            },
          },
        } satisfies AuthProfileStore,
      },
      resolvedConfig: config,
    });

    expect(capturedContext?.hasAuthForProvider?.("openai")).toBe(true);
    expect(capturedContext?.hasAuthForProvider?.("anthropic")).toBe(false);
    await expect(capturedContext?.resolveApiKeyForProvider?.("openai")).resolves.toBe("sk-test");
  });

  it("forwards gateway subagent binding to plugin resolution", () => {
    hoisted.resolvePluginTools.mockReturnValue([]);
    const config = {
      plugins: {
        allow: ["browser"],
      },
    } as KovaConfig;

    resolveKovaPluginToolsForOptions({
      options: { config, allowGatewaySubagentBinding: true },
      resolvedConfig: config,
    });

    expect(hoisted.resolvePluginTools).toHaveBeenCalledWith(
      expect.objectContaining({
        allowGatewaySubagentBinding: true,
      }),
    );
  });

  it("does not pass a stale active snapshot as plugin runtime config for a resolved run config", () => {
    const staleSourceConfig = {
      plugins: {
        allow: ["old-plugin"],
      },
    } as KovaConfig;
    const staleRuntimeConfig = {
      plugins: {
        allow: ["old-plugin"],
      },
    } as KovaConfig;
    const resolvedRunConfig = {
      plugins: {
        allow: ["browser"],
      },
      tools: {
        experimental: {
          planTool: true,
        },
      },
    } as KovaConfig;
    let capturedRuntimeConfig: KovaConfig | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      capturedRuntimeConfig = (params as { context?: { runtimeConfig?: KovaConfig } }).context
        ?.runtimeConfig;
      return [];
    });
    activateSecretsRuntimeSnapshot({
      sourceConfig: staleSourceConfig,
      config: staleRuntimeConfig,
      authStores: [],
      warnings: [],
      webTools: {
        search: {
          providerSource: "none",
          diagnostics: [],
        },
        fetch: {
          providerSource: "none",
          diagnostics: [],
        },
        diagnostics: [],
      },
    });

    resolveKovaPluginToolsForOptions({
      options: { config: resolvedRunConfig },
      resolvedConfig: resolvedRunConfig,
    });

    expect(capturedRuntimeConfig).toBe(resolvedRunConfig);
  });

  it("exposes a live runtime config getter to plugin tool factories", () => {
    const sourceConfig = {
      plugins: {
        allow: ["memory-core"],
      },
    } as KovaConfig;
    const firstRuntimeConfig = {
      plugins: {
        allow: ["memory-core"],
        entries: { "memory-core": { enabled: true } },
      },
    } as KovaConfig;
    const nextRuntimeConfig = {
      plugins: {
        allow: ["memory-core"],
        entries: { "memory-core": { enabled: false } },
      },
    } as KovaConfig;
    let getRuntimeConfig: (() => KovaConfig | undefined) | undefined;
    hoisted.resolvePluginTools.mockImplementation((params: unknown) => {
      getRuntimeConfig = (
        params as { context?: { getRuntimeConfig?: () => KovaConfig | undefined } }
      ).context?.getRuntimeConfig;
      return [];
    });
    activateSecretsRuntimeSnapshot({
      sourceConfig,
      config: firstRuntimeConfig,
      authStores: [],
      warnings: [],
      webTools: {
        search: {
          providerSource: "none",
          diagnostics: [],
        },
        fetch: {
          providerSource: "none",
          diagnostics: [],
        },
        diagnostics: [],
      },
    });

    resolveKovaPluginToolsForOptions({
      options: { config: sourceConfig },
      resolvedConfig: sourceConfig,
    });

    expect(getRuntimeConfig?.()).toStrictEqual(firstRuntimeConfig);

    activateSecretsRuntimeSnapshot({
      sourceConfig,
      config: nextRuntimeConfig,
      authStores: [],
      warnings: [],
      webTools: {
        search: {
          providerSource: "none",
          diagnostics: [],
        },
        fetch: {
          providerSource: "none",
          diagnostics: [],
        },
        diagnostics: [],
      },
    });

    expect(getRuntimeConfig?.()).toStrictEqual(nextRuntimeConfig);
    expect(getRuntimeConfig?.()?.plugins?.entries?.["memory-core"]?.enabled).toBe(false);
  });
});
