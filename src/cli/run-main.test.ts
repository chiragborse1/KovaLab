import { describe, expect, it } from "vitest";
import type { PluginManifestCommandAliasRegistry } from "../plugins/manifest-command-aliases.js";
import {
  rewriteUpdateFlagArgv,
  rewriteBareRootArgvToLocalChat,
  resolveMissingPluginCommandMessage,
  shouldEnsureCliPath,
  shouldStartLocalChatForBareRoot,
  shouldUseBrowserHelpFastPath,
  shouldUseRootHelpFastPath,
} from "./run-main-policy.js";

const memoryWikiCommandAliasRegistry: PluginManifestCommandAliasRegistry = {
  plugins: [
    {
      id: "memory-wiki",
      commandAliases: [{ name: "wiki" }],
    },
  ],
};

const memoryCoreCommandAliasRegistry: PluginManifestCommandAliasRegistry = {
  plugins: [
    {
      id: "memory-core",
      commandAliases: [{ name: "dreaming", kind: "runtime-slash", cliCommand: "memory" }],
    },
  ],
};

describe("rewriteUpdateFlagArgv", () => {
  it("leaves argv unchanged when --update is absent", () => {
    const argv = ["node", "entry.js", "status"];
    expect(rewriteUpdateFlagArgv(argv)).toBe(argv);
  });

  it("rewrites --update into the update command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update"])).toEqual([
      "node",
      "entry.js",
      "update",
    ]);
  });

  it("preserves global flags that appear before --update", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--profile", "p", "--update"])).toEqual([
      "node",
      "entry.js",
      "--profile",
      "p",
      "update",
    ]);
  });

  it("keeps update options after the rewritten command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update", "--json"])).toEqual([
      "node",
      "entry.js",
      "update",
      "--json",
    ]);
  });
});

describe("shouldEnsureCliPath", () => {
  it("skips path bootstrap for help/version invocations", () => {
    expect(shouldEnsureCliPath(["node", "kova", "--help"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "kova", "-V"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "kova", "-v"])).toBe(false);
  });

  it("skips path bootstrap for read-only fast paths", () => {
    expect(shouldEnsureCliPath(["node", "kova", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "kova", "--log-level", "debug", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "kova", "sessions", "--json"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "kova", "config", "get", "update"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "kova", "models", "status", "--json"])).toBe(false);
  });

  it("keeps path bootstrap for mutating or unknown commands", () => {
    expect(shouldEnsureCliPath(["node", "kova"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "kova", "--profile", "work"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "kova", "message", "send"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "kova", "voicecall", "status"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "kova", "acp", "-v"])).toBe(true);
  });
});

describe("shouldStartLocalChatForBareRoot", () => {
  it("starts local chat for bare root invocations", () => {
    expect(shouldStartLocalChatForBareRoot(["node", "kova"])).toBe(true);
    expect(shouldStartLocalChatForBareRoot(["node", "kova", "--profile", "work"])).toBe(true);
    expect(shouldStartLocalChatForBareRoot(["node", "kova", "--dev"])).toBe(true);
  });

  it("does not start local chat for help, version, or commands", () => {
    expect(shouldStartLocalChatForBareRoot(["node", "kova", "--help"])).toBe(false);
    expect(shouldStartLocalChatForBareRoot(["node", "kova", "-V"])).toBe(false);
    expect(shouldStartLocalChatForBareRoot(["node", "kova", "status"])).toBe(false);
  });
});

describe("rewriteBareRootArgvToLocalChat", () => {
  it("routes bare root invocations to local chat", () => {
    expect(rewriteBareRootArgvToLocalChat(["node", "kova"])).toEqual(["node", "kova", "chat"]);
    expect(rewriteBareRootArgvToLocalChat(["node", "kova", "--profile", "work"])).toEqual([
      "node",
      "kova",
      "--profile",
      "work",
      "chat",
    ]);
  });

  it("leaves explicit commands and help alone", () => {
    expect(rewriteBareRootArgvToLocalChat(["node", "kova", "onboard"])).toEqual([
      "node",
      "kova",
      "onboard",
    ]);
    expect(rewriteBareRootArgvToLocalChat(["node", "kova", "--help"])).toEqual([
      "node",
      "kova",
      "--help",
    ]);
  });
});

describe("shouldUseRootHelpFastPath", () => {
  it("uses the fast path for root help only", () => {
    expect(shouldUseRootHelpFastPath(["node", "kova", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "kova", "--profile", "work", "-h"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "kova", "help", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "kova", "status", "--help"])).toBe(false);
    expect(shouldUseRootHelpFastPath(["node", "kova", "--help", "status"])).toBe(false);
    expect(shouldUseRootHelpFastPath(["node", "kova", "help", "gateway"])).toBe(false);
  });
});

describe("shouldUseBrowserHelpFastPath", () => {
  it("uses the fast path for browser command help only", () => {
    expect(shouldUseBrowserHelpFastPath(["node", "kova", "browser", "--help"])).toBe(true);
    expect(shouldUseBrowserHelpFastPath(["node", "kova", "browser", "-h"])).toBe(true);
    expect(
      shouldUseBrowserHelpFastPath(["node", "kova", "--profile", "work", "browser", "-h"]),
    ).toBe(true);
    expect(shouldUseBrowserHelpFastPath(["node", "kova", "browser", "status", "--help"])).toBe(
      false,
    );
    expect(shouldUseBrowserHelpFastPath(["node", "kova", "status", "--help"])).toBe(false);
  });
});

describe("resolveMissingPluginCommandMessage", () => {
  it("explains plugins.allow misses for a bundled plugin command", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          allow: ["quietchat"],
        },
      }),
    ).toContain('`plugins.allow` excludes "browser"');
  });

  it("keeps the removed dashboard command pointed at terminal-first surfaces", () => {
    const message = resolveMissingPluginCommandMessage("dashboard", {
      plugins: {
        allow: ["quietchat"],
      },
    });
    expect(message).toContain("has been removed");
    expect(message).toContain("kova chat");
    expect(message).toContain("kova control-ui");
    expect(message).not.toContain("plugins.allow");
  });

  it("explains explicit bundled plugin disablement", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          entries: {
            browser: {
              enabled: false,
            },
          },
        },
      }),
    ).toContain("plugins.entries.browser.enabled=false");
  });

  it("returns null when the bundled plugin command is already allowed", () => {
    expect(
      resolveMissingPluginCommandMessage("browser", {
        plugins: {
          allow: ["browser"],
        },
      }),
    ).toBeNull();
  });

  it("explains that dreaming is a runtime slash command, not a CLI command", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {},
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain("runtime slash command");
    expect(message).toContain("/dreaming");
    expect(message).toContain("memory-core");
    expect(message).toContain("kova memory");
  });

  it("returns the runtime command message even when plugins.allow is set", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {
        plugins: {
          allow: ["memory-core"],
        },
      },
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain("runtime slash command");
    expect(message).not.toContain("plugins.allow");
  });

  it("points command names in plugins.allow at their parent plugin", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {
        plugins: {
          allow: ["dreaming"],
        },
      },
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain('"dreaming" is not a plugin');
    expect(message).toContain('"memory-core"');
    expect(message).toContain("plugins.allow");
  });

  it("explains parent plugin disablement for runtime command aliases", () => {
    const message = resolveMissingPluginCommandMessage(
      "dreaming",
      {
        plugins: {
          entries: {
            "memory-core": {
              enabled: false,
            },
          },
        },
      },
      {
        registry: memoryCoreCommandAliasRegistry,
      },
    );
    expect(message).toContain("plugins.entries.memory-core.enabled=false");
    expect(message).not.toContain("runtime slash command");
  });

  it("allows CLI commands when their parent plugin is in plugins.allow", () => {
    const message = resolveMissingPluginCommandMessage(
      "wiki",
      {
        plugins: {
          allow: ["memory-wiki"],
        },
      },
      { registry: memoryWikiCommandAliasRegistry },
    );
    expect(message).toBeNull();
  });

  it("blocks CLI commands when parent plugin is NOT in plugins.allow", () => {
    const message = resolveMissingPluginCommandMessage(
      "wiki",
      {
        plugins: {
          allow: ["quietchat"],
        },
      },
      { registry: memoryWikiCommandAliasRegistry },
    );
    expect(message).not.toBeNull();
    expect(message).toContain('"memory-wiki"');
    expect(message).toContain("plugins.allow");
  });
});
