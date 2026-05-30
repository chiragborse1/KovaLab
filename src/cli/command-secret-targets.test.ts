import { describe, expect, it, vi } from "vitest";

const REGISTRY_IDS = [
  "agents.defaults.memorySearch.remote.apiKey",
  "agents.list[].memorySearch.remote.apiKey",
  "channels.discord.token",
  "channels.discord.accounts.ops.token",
  "channels.discord.accounts.chat.token",
  "channels.telegram.botToken",
  "gateway.auth.token",
  "gateway.auth.password",
  "gateway.remote.token",
  "gateway.remote.password",
  "models.providers.*.apiKey",
  "messages.tts.providers.openai.apiKey",
  "plugins.entries.brave.config.webSearch.apiKey",
  "plugins.entries.firecrawl.config.webFetch.apiKey",
  "plugins.entries.firecrawl.config.webSearch.apiKey",
  "plugins.entries.exa.config.webSearch.apiKey",
  "skills.entries.demo.apiKey",
  "tools.web.fetch.firecrawl.apiKey",
  "tools.web.search.apiKey",
  "tools.web.search.*.apiKey",
] as const;

function readPath(source: unknown, path: string): unknown {
  let current = source;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

vi.mock("../secrets/target-registry.js", () => ({
  listSecretTargetRegistryEntries: vi.fn(() =>
    REGISTRY_IDS.map((id) => ({
      id,
      pathPattern: id,
    })),
  ),
  discoverConfigSecretTargetsByIds: vi.fn((config: unknown, targetIds?: Iterable<string>) => {
    const allowed = targetIds ? new Set(targetIds) : null;
    const out: Array<{ entry: { id: string }; path: string; pathSegments: string[] }> = [];
    const matches = (pattern: string, path: string): boolean => {
      const patternSegments = pattern.split(".");
      const pathSegments = path.split(".");
      if (patternSegments.length !== pathSegments.length) {
        return false;
      }
      return patternSegments.every(
        (segment, index) => segment === "*" || segment === pathSegments[index],
      );
    };
    const collectPaths = (node: unknown, segments: string[], prefix: string[] = []): string[] => {
      const [segment, ...rest] = segments;
      if (!segment) {
        return node === undefined ? [] : [prefix.join(".")];
      }
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        return [];
      }
      if (segment === "*") {
        return Object.entries(node).flatMap(([key, value]) =>
          collectPaths(value, rest, [...prefix, key]),
        );
      }
      return collectPaths((node as Record<string, unknown>)[segment], rest, [...prefix, segment]);
    };
    const record = (targetId: string, path: string) => {
      if (allowed && !allowed.has(targetId)) {
        return;
      }
      out.push({ entry: { id: targetId }, path, pathSegments: path.split(".") });
    };
    for (const id of REGISTRY_IDS) {
      if (id.includes("*")) {
        for (const path of collectPaths(config, id.split("."))) {
          if (matches(id, path)) {
            record(id, path);
          }
        }
        continue;
      }
      if (readPath(config, id) !== undefined) {
        record(id, id);
      }
    }
    return out;
  }),
}));

vi.mock("../plugins/web-fetch-providers.runtime.js", () => ({
  resolvePluginWebFetchProviders: vi.fn((params: { config?: Record<string, unknown> }) => [
    {
      pluginId: "firecrawl",
      id: "firecrawl",
      autoDetectOrder: 50,
      credentialPath: "plugins.entries.firecrawl.config.webFetch.apiKey",
      getConfiguredCredentialValue: (config?: {
        plugins?: {
          entries?: {
            firecrawl?: { config?: { webFetch?: { apiKey?: unknown } } };
          };
        };
      }) => config?.plugins?.entries?.firecrawl?.config?.webFetch?.apiKey,
      getConfiguredCredentialFallback: () => ({
        path: "plugins.entries.firecrawl.config.webSearch.apiKey",
        value: (
          params.config as {
            plugins?: {
              entries?: {
                firecrawl?: { config?: { webSearch?: { apiKey?: unknown } } };
              };
            };
          }
        )?.plugins?.entries?.firecrawl?.config?.webSearch?.apiKey,
      }),
      getCredentialValue: (fetchConfig?: { firecrawl?: { apiKey?: unknown } }) =>
        fetchConfig?.firecrawl?.apiKey,
    },
  ]),
}));

vi.mock("../plugins/web-search-providers.runtime.js", () => ({
  resolvePluginWebSearchProviders: vi.fn(() => [
    {
      pluginId: "brave",
      id: "brave",
      autoDetectOrder: 10,
      credentialPath: "plugins.entries.brave.config.webSearch.apiKey",
      getConfiguredCredentialValue: (config?: {
        plugins?: {
          entries?: {
            brave?: { config?: { webSearch?: { apiKey?: unknown } } };
          };
        };
      }) => config?.plugins?.entries?.brave?.config?.webSearch?.apiKey,
      getConfiguredCredentialFallback: (): undefined => undefined,
      getCredentialValue: (searchConfig?: { apiKey?: unknown }) => searchConfig?.apiKey,
    },
    {
      pluginId: "firecrawl",
      id: "firecrawl",
      autoDetectOrder: 60,
      credentialPath: "plugins.entries.firecrawl.config.webSearch.apiKey",
      getConfiguredCredentialValue: (config?: {
        plugins?: {
          entries?: {
            firecrawl?: {
              config?: { webFetch?: { apiKey?: unknown }; webSearch?: { apiKey?: unknown } };
            };
          };
        };
      }) => config?.plugins?.entries?.firecrawl?.config?.webSearch?.apiKey,
      getConfiguredCredentialFallback: (config?: {
        plugins?: {
          entries?: {
            firecrawl?: { config?: { webFetch?: { apiKey?: unknown } } };
          };
        };
      }) => {
        const apiKey = config?.plugins?.entries?.firecrawl?.config?.webFetch?.apiKey;
        return apiKey === undefined
          ? undefined
          : {
              path: "plugins.entries.firecrawl.config.webFetch.apiKey",
              value: apiKey,
            };
      },
      getCredentialValue: (): undefined => undefined,
    },
    {
      pluginId: "exa",
      id: "exa",
      autoDetectOrder: 65,
      credentialPath: "plugins.entries.exa.config.webSearch.apiKey",
      getConfiguredCredentialValue: (config?: {
        plugins?: {
          entries?: {
            exa?: { config?: { webSearch?: { apiKey?: unknown } } };
          };
        };
      }) => config?.plugins?.entries?.exa?.config?.webSearch?.apiKey,
      getConfiguredCredentialFallback: (): undefined => undefined,
      getCredentialValue: (searchConfig?: { exa?: { apiKey?: unknown } }) =>
        searchConfig?.exa?.apiKey,
    },
  ]),
}));

import {
  getAgentRuntimeCommandSecretTargetIds,
  getCapabilityWebFetchCommandSecretTargetIds,
  getCapabilityWebSearchCommandSecretTargets,
  getCapabilityWebSearchCommandSecretTargetIds,
  getModelsCommandSecretTargetIds,
  getQrRemoteCommandSecretTargetIds,
  getScopedChannelsCommandSecretTargets,
  getSecurityAuditCommandSecretTargetIds,
} from "./command-secret-targets.js";

describe("command secret target ids", () => {
  it("keeps static qr remote targets out of the registry path", () => {
    const ids = getQrRemoteCommandSecretTargetIds();
    expect(ids).toEqual(new Set(["gateway.remote.token", "gateway.remote.password"]));
  });

  it("keeps static model targets out of the registry path", () => {
    const ids = getModelsCommandSecretTargetIds();
    expect(ids.has("models.providers.*.apiKey")).toBe(true);
    expect(ids.has("models.providers.*.request.tls.key")).toBe(true);
    expect(ids.has("channels.discord.token")).toBe(false);
  });

  it("includes memorySearch remote targets for agent runtime commands", () => {
    const ids = getAgentRuntimeCommandSecretTargetIds();
    expect(ids.has("agents.defaults.memorySearch.remote.apiKey")).toBe(true);
    expect(ids.has("agents.list[].memorySearch.remote.apiKey")).toBe(true);
    expect(ids.has("plugins.entries.firecrawl.config.webFetch.apiKey")).toBe(true);
    expect(ids.has("plugins.entries.exa.config.webSearch.apiKey")).toBe(true);
    expect(ids.has("channels.discord.token")).toBe(false);
  });

  it("scopes capability web search commands to search credential surfaces only", () => {
    const ids = getCapabilityWebSearchCommandSecretTargetIds();
    expect(ids.has("tools.web.search.apiKey")).toBe(true);
    expect(ids.has("tools.web.search.*.apiKey")).toBe(true);
    expect(ids.has("plugins.entries.exa.config.webSearch.apiKey")).toBe(true);
    expect(ids.has("plugins.entries.firecrawl.config.webFetch.apiKey")).toBe(false);
    expect(ids.has("models.providers.*.apiKey")).toBe(false);
    expect(ids.has("channels.discord.token")).toBe(false);
  });

  it("scopes capability web fetch commands to fetch credential surfaces only", () => {
    const ids = getCapabilityWebFetchCommandSecretTargetIds();
    expect(ids.has("tools.web.search.apiKey")).toBe(false);
    expect(ids.has("tools.web.fetch.firecrawl.apiKey")).toBe(true);
    expect(ids.has("plugins.entries.exa.config.webSearch.apiKey")).toBe(false);
    expect(ids.has("plugins.entries.firecrawl.config.webFetch.apiKey")).toBe(true);
    expect(ids.has("models.providers.*.apiKey")).toBe(false);
    expect(ids.has("channels.discord.token")).toBe(false);
  });

  it("scopes configured web search command targets to the selected provider", () => {
    const scoped = getCapabilityWebSearchCommandSecretTargets({
      tools: { web: { search: { provider: "firecrawl", enabled: true } } },
      plugins: {
        entries: {
          firecrawl: {
            config: {
              webSearch: {
                apiKey: { source: "env", provider: "default", id: "FIRECRAWL_API_KEY" },
              },
            },
          },
          exa: {
            config: {
              webSearch: {
                apiKey: { source: "env", provider: "default", id: "EXA_API_KEY" },
              },
            },
          },
        },
      },
    } as never);

    expect(scoped.targetIds).toEqual(
      new Set(["plugins.entries.firecrawl.config.webSearch.apiKey"]),
    );
    expect(scoped.forcedActivePaths).toBeUndefined();
  });

  it("uses explicit web provider overrides when scoping command targets", () => {
    const scoped = getCapabilityWebSearchCommandSecretTargets(
      {
        tools: { web: { search: { provider: "exa", enabled: true } } },
        plugins: {
          entries: {
            firecrawl: {
              config: {
                webSearch: {
                  apiKey: { source: "env", provider: "default", id: "FIRECRAWL_API_KEY" },
                },
              },
            },
            exa: {
              config: {
                webSearch: {
                  apiKey: { source: "env", provider: "default", id: "EXA_API_KEY" },
                },
              },
            },
          },
        },
      } as never,
      { providerId: "firecrawl" },
    );

    expect(scoped.targetIds).toEqual(
      new Set(["plugins.entries.firecrawl.config.webSearch.apiKey"]),
    );
    expect(scoped.forcedActivePaths).toEqual(
      new Set(["plugins.entries.firecrawl.config.webSearch.apiKey"]),
    );
  });

  it("uses Firecrawl web fetch credentials as search fallback targets", () => {
    const scoped = getCapabilityWebSearchCommandSecretTargets({
      tools: { web: { search: { provider: "firecrawl", enabled: true } } },
      plugins: {
        entries: {
          firecrawl: {
            config: {
              webFetch: {
                apiKey: { source: "env", provider: "default", id: "FIRECRAWL_API_KEY" },
              },
            },
          },
        },
      },
    } as never);

    expect(scoped.targetIds).toEqual(
      new Set([
        "plugins.entries.firecrawl.config.webFetch.apiKey",
        "plugins.entries.firecrawl.config.webSearch.apiKey",
      ]),
    );
    expect(scoped.forcedActivePaths).toEqual(
      new Set(["plugins.entries.firecrawl.config.webFetch.apiKey"]),
    );
  });

  it("includes channel targets for agent runtime when delivery needs them", () => {
    const ids = getAgentRuntimeCommandSecretTargetIds({ includeChannelTargets: true });
    expect(ids.has("channels.discord.token")).toBe(true);
    expect(ids.has("channels.telegram.botToken")).toBe(true);
  });

  it("includes gateway auth and channel targets for security audit", () => {
    const ids = getSecurityAuditCommandSecretTargetIds();
    expect(ids.has("channels.discord.token")).toBe(true);
    expect(ids.has("gateway.auth.token")).toBe(true);
    expect(ids.has("gateway.auth.password")).toBe(true);
    expect(ids.has("gateway.remote.token")).toBe(true);
    expect(ids.has("gateway.remote.password")).toBe(true);
  });

  it("scopes channel targets to the requested channel", () => {
    const scoped = getScopedChannelsCommandSecretTargets({
      config: {} as never,
      channel: "discord",
    });

    expect(scoped.targetIds.size).toBeGreaterThan(0);
    expect([...scoped.targetIds].every((id) => id.startsWith("channels.discord."))).toBe(true);
    expect([...scoped.targetIds].some((id) => id.startsWith("channels.telegram."))).toBe(false);
  });

  it("does not coerce missing accountId to default when channel is scoped", () => {
    const scoped = getScopedChannelsCommandSecretTargets({
      config: {
        channels: {
          discord: {
            defaultAccount: "ops",
            accounts: {
              ops: {
                token: { source: "env", provider: "default", id: "DISCORD_OPS" },
              },
            },
          },
        },
      } as never,
      channel: "discord",
    });

    expect(scoped.allowedPaths).toBeUndefined();
    expect(scoped.targetIds.size).toBeGreaterThan(0);
    expect([...scoped.targetIds].every((id) => id.startsWith("channels.discord."))).toBe(true);
  });

  it("scopes allowed paths to channel globals + selected account", () => {
    const scoped = getScopedChannelsCommandSecretTargets({
      config: {
        channels: {
          discord: {
            token: { source: "env", provider: "default", id: "DISCORD_DEFAULT" },
            accounts: {
              ops: {
                token: { source: "env", provider: "default", id: "DISCORD_OPS" },
              },
              chat: {
                token: { source: "env", provider: "default", id: "DISCORD_CHAT" },
              },
            },
          },
        },
      } as never,
      channel: "discord",
      accountId: "ops",
    });

    expect(scoped.allowedPaths).toBeDefined();
    expect(scoped.allowedPaths?.has("channels.discord.token")).toBe(true);
    expect(scoped.allowedPaths?.has("channels.discord.accounts.ops.token")).toBe(true);
    expect(scoped.allowedPaths?.has("channels.discord.accounts.chat.token")).toBe(false);
  });

  it("keeps account-scoped allowedPaths as an empty set when scoped target paths are absent", () => {
    const scoped = getScopedChannelsCommandSecretTargets({
      config: {
        channels: {
          discord: {
            accounts: {
              ops: { enabled: true },
            },
          },
        },
      } as never,
      channel: "custom-plugin-channel-without-secret-targets",
      accountId: "ops",
    });

    expect(scoped.allowedPaths).toBeDefined();
    expect(scoped.allowedPaths?.size).toBe(0);
  });
});
