import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { installedPluginRoot } from "../../test/helpers/bundled-plugin-paths.js";
import type { KovaConfig } from "../config/config.js";
import {
  applyExclusiveSlotSelection,
  buildPluginDiagnosticsReport,
  clearPluginManifestRegistryCache,
  enablePluginInConfig,
  installHooksFromNpmSpec,
  installHooksFromPath,
  installPluginFromKovaHub,
  installPluginFromMarketplace,
  installPluginFromNpmSpec,
  installPluginFromPath,
  loadConfig,
  readConfigFileSnapshot,
  parseKovaHubPluginSpec,
  recordHookInstall,
  recordPluginInstall,
  resetPluginsCliTestState,
  replaceConfigFile,
  runPluginsCommand,
  runtimeErrors,
  runtimeLogs,
  writeConfigFile,
  writePersistedInstalledPluginIndexInstallRecords,
} from "./plugins-cli-test-helpers.js";

const CLI_STATE_ROOT = "/tmp/kova-state";

function cliInstallPath(pluginId: string): string {
  return installedPluginRoot(CLI_STATE_ROOT, pluginId);
}

function createEnabledPluginConfig(pluginId: string): KovaConfig {
  return {
    plugins: {
      entries: {
        [pluginId]: {
          enabled: true,
        },
      },
    },
  } as KovaConfig;
}

function createEmptyPluginConfig(): KovaConfig {
  return {
    plugins: {
      entries: {},
    },
  } as KovaConfig;
}

function createKovaHubInstallResult(params: {
  pluginId: string;
  packageName: string;
  version: string;
  channel: string;
}): Awaited<ReturnType<typeof installPluginFromKovaHub>> {
  return {
    ok: true,
    pluginId: params.pluginId,
    targetDir: cliInstallPath(params.pluginId),
    version: params.version,
    packageName: params.packageName,
    kovahub: {
      source: "kovahub",
      kovahubUrl: "https://kovahub.ai",
      kovahubPackage: params.packageName,
      kovahubFamily: "code-plugin",
      kovahubChannel: params.channel,
      version: params.version,
      integrity: "sha256-abc",
      resolvedAt: "2026-03-22T00:00:00.000Z",
    },
  };
}

function createNpmPluginInstallResult(
  pluginId = "demo",
): Awaited<ReturnType<typeof installPluginFromNpmSpec>> {
  return {
    ok: true,
    pluginId,
    targetDir: cliInstallPath(pluginId),
    version: "1.2.3",
    npmResolution: {
      packageName: pluginId,
      resolvedVersion: "1.2.3",
      tarballUrl: `https://registry.npmjs.org/${pluginId}/-/${pluginId}-1.2.3.tgz`,
    },
  };
}

function mockKovaHubPackageNotFound(packageName: string) {
  installPluginFromKovaHub.mockResolvedValue({
    ok: false,
    error: `KovaHub /api/v1/packages/${packageName} failed (404): Package not found`,
    code: "package_not_found",
  });
}

function primeNpmPluginFallback(pluginId = "demo") {
  const cfg = createEmptyPluginConfig();
  const enabledCfg = createEnabledPluginConfig(pluginId);

  loadConfig.mockReturnValue(cfg);
  mockKovaHubPackageNotFound(pluginId);
  installPluginFromNpmSpec.mockResolvedValue(createNpmPluginInstallResult(pluginId));
  enablePluginInConfig.mockReturnValue({ config: enabledCfg });
  recordPluginInstall.mockReturnValue(enabledCfg);
  applyExclusiveSlotSelection.mockReturnValue({
    config: enabledCfg,
    warnings: [],
  });

  return { cfg, enabledCfg };
}

function createPathHookPackInstalledConfig(tmpRoot: string): KovaConfig {
  return {
    hooks: {
      internal: {
        installs: {
          "demo-hooks": {
            source: "path",
            sourcePath: tmpRoot,
            installPath: tmpRoot,
          },
        },
      },
    },
  } as KovaConfig;
}

function createNpmHookPackInstalledConfig(): KovaConfig {
  return {
    hooks: {
      internal: {
        installs: {
          "demo-hooks": {
            source: "npm",
            spec: "@acme/demo-hooks@1.2.3",
          },
        },
      },
    },
  } as KovaConfig;
}

function createHookPackInstallResult(targetDir: string): {
  ok: true;
  hookPackId: string;
  hooks: string[];
  targetDir: string;
  version: string;
} {
  return {
    ok: true,
    hookPackId: "demo-hooks",
    hooks: ["command-audit"],
    targetDir,
    version: "1.2.3",
  };
}

function primeHookPackNpmFallback() {
  const cfg = {} as KovaConfig;
  const installedCfg = createNpmHookPackInstalledConfig();

  loadConfig.mockReturnValue(cfg);
  mockKovaHubPackageNotFound("@acme/demo-hooks");
  installPluginFromNpmSpec.mockResolvedValue({
    ok: false,
    error: "package.json missing kova.plugin.json",
  });
  installHooksFromNpmSpec.mockResolvedValue({
    ...createHookPackInstallResult("/tmp/hooks/demo-hooks"),
    npmResolution: {
      name: "@acme/demo-hooks",
      spec: "@acme/demo-hooks@1.2.3",
      integrity: "sha256-demo",
    },
  });
  recordHookInstall.mockReturnValue(installedCfg);

  return { cfg, installedCfg };
}

function primeBlockedNpmPluginInstall(params: {
  spec: string;
  pluginId: string;
  code?: "security_scan_blocked" | "security_scan_failed";
}) {
  loadConfig.mockReturnValue({} as KovaConfig);
  mockKovaHubPackageNotFound(params.spec);
  installPluginFromNpmSpec.mockResolvedValue({
    ok: false,
    error: `Plugin "${params.pluginId}" installation blocked: dangerous code patterns detected: finding details`,
    code: params.code ?? "security_scan_blocked",
  });
}

function primeHookPackPathFallback(params: {
  tmpRoot: string;
  pluginInstallError: string;
}): KovaConfig {
  const installedCfg = createPathHookPackInstalledConfig(params.tmpRoot);

  loadConfig.mockReturnValue({} as KovaConfig);
  installPluginFromPath.mockResolvedValueOnce({
    ok: false,
    error: params.pluginInstallError,
  });
  installHooksFromPath.mockResolvedValueOnce(createHookPackInstallResult(params.tmpRoot));
  recordHookInstall.mockReturnValue(installedCfg);

  return installedCfg;
}

describe("plugins cli install", () => {
  beforeEach(() => {
    resetPluginsCliTestState();
  });

  it("shows the force overwrite option in install help", async () => {
    const { Command } = await import("commander");
    const { registerPluginsCli } = await import("./plugins-cli.js");
    const program = new Command();
    registerPluginsCli(program);

    const pluginsCommand = program.commands.find((command) => command.name() === "plugins");
    const installCommand = pluginsCommand?.commands.find((command) => command.name() === "install");
    const helpText = installCommand?.helpInformation() ?? "";

    expect(helpText).toContain("--force");
    expect(helpText).toContain("Overwrite an existing installed plugin or");
    expect(helpText).toContain("hook pack");
  });

  it("exits when --marketplace is combined with --link", async () => {
    await expect(
      runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo", "--link"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain("`--link` is not supported with `--marketplace`.");
    expect(installPluginFromMarketplace).not.toHaveBeenCalled();
  });

  it("exits when --force is combined with --link", async () => {
    await expect(
      runPluginsCommand(["plugins", "install", "./plugin", "--link", "--force"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain("`--force` is not supported with `--link`.");
    expect(installPluginFromMarketplace).not.toHaveBeenCalled();
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
  });

  it("exits when marketplace install fails", async () => {
    await expect(
      runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo"]),
    ).rejects.toThrow("__exit__:1");

    expect(installPluginFromMarketplace).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "local/repo",
        plugin: "alpha",
      }),
    );
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it("fails closed for unrelated invalid config before installer side effects", async () => {
    const invalidConfigErr = new Error("config invalid");
    (invalidConfigErr as { code?: string }).code = "INVALID_CONFIG";
    loadConfig.mockImplementation(() => {
      throw invalidConfigErr;
    });
    readConfigFileSnapshot.mockResolvedValue({
      path: "/tmp/kova-config.json5",
      exists: true,
      raw: '{ "models": { "default": 123 } }',
      parsed: { models: { default: 123 } },
      resolved: { models: { default: 123 } },
      valid: false,
      config: { models: { default: 123 } },
      hash: "mock",
      issues: [{ path: "models.default", message: "invalid model ref" }],
      warnings: [],
      legacyIssues: [],
    });

    await expect(runPluginsCommand(["plugins", "install", "alpha"])).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain(
      "Config invalid; run `kova doctor --fix` before installing plugins.",
    );
    expect(installPluginFromMarketplace).not.toHaveBeenCalled();
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
  });

  it("installs marketplace plugins and persists plugin index", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = {
      plugins: {
        entries: {
          alpha: {
            enabled: true,
          },
        },
      },
    } as KovaConfig;
    loadConfig.mockReturnValue(cfg);
    installPluginFromMarketplace.mockResolvedValue({
      ok: true,
      pluginId: "alpha",
      targetDir: cliInstallPath("alpha"),
      extensions: ["index.js"],
      version: "1.2.3",
      marketplaceName: "Claude",
      marketplaceSource: "local/repo",
      marketplacePlugin: "alpha",
    });
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    buildPluginDiagnosticsReport.mockReturnValue({
      plugins: [{ id: "alpha", kind: "provider" }],
      diagnostics: [],
    });
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: ["slot adjusted"],
    });

    await runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo"]);

    expect(clearPluginManifestRegistryCache).toHaveBeenCalledTimes(1);
    expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
      alpha: expect.objectContaining({
        source: "marketplace",
        installPath: cliInstallPath("alpha"),
      }),
    });
    expect(writeConfigFile).toHaveBeenCalledWith(enabledCfg);
    expect(replaceConfigFile).toHaveBeenCalledWith(
      expect.objectContaining({
        baseHash: "mock",
        nextConfig: enabledCfg,
      }),
    );
    expect(runtimeLogs.some((line) => line.includes("slot adjusted"))).toBe(true);
    expect(runtimeLogs.some((line) => line.includes("Installed plugin: alpha"))).toBe(true);
  });

  it("passes force through as overwrite mode for marketplace installs", async () => {
    await expect(
      runPluginsCommand(["plugins", "install", "alpha", "--marketplace", "local/repo", "--force"]),
    ).rejects.toThrow("__exit__:1");

    expect(installPluginFromMarketplace).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "local/repo",
        plugin: "alpha",
        mode: "update",
      }),
    );
  });

  it("installs KovaHub plugins and persists source metadata", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");
    loadConfig.mockReturnValue(cfg);
    parseKovaHubPluginSpec.mockReturnValue({ name: "demo" });
    installPluginFromKovaHub.mockResolvedValue(
      createKovaHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "official",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "kovahub:demo"]);

    expect(installPluginFromKovaHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "kovahub:demo",
      }),
    );
    expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
      demo: expect.objectContaining({
        source: "kovahub",
        spec: "kovahub:demo",
        installPath: cliInstallPath("demo"),
        version: "1.2.3",
        kovahubPackage: "demo",
        kovahubFamily: "code-plugin",
        kovahubChannel: "official",
      }),
    });
    expect(writeConfigFile).toHaveBeenCalledWith(enabledCfg);
    expect(runtimeLogs.some((line) => line.includes("Installed plugin: demo"))).toBe(true);
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
  });

  it("does not persist incomplete config entries for config-gated bundled installs", async () => {
    const bundledRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kova-bundled-config-"));
    const pluginId = "needs-config";
    const pluginRoot = path.join(bundledRoot, pluginId);
    const previousBundledDir = process.env.KOVA_BUNDLED_PLUGINS_DIR;
    process.env.KOVA_BUNDLED_PLUGINS_DIR = bundledRoot;
    fs.mkdirSync(pluginRoot, { recursive: true });
    fs.writeFileSync(
      path.join(pluginRoot, "package.json"),
      JSON.stringify(
        {
          name: "@kovaai/needs-config",
          version: "1.0.0",
          type: "module",
          kova: { extensions: ["./index.ts"] },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(pluginRoot, "kova.plugin.json"),
      JSON.stringify(
        {
          id: pluginId,
          configSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              apiKey: { type: "string" },
            },
            required: ["apiKey"],
          },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(pluginRoot, "index.ts"), "export default {};\n");
    const cfg = {
      plugins: {
        entries: {
          [pluginId]: {
            config: {},
          },
        },
        load: {
          paths: ["/existing/plugin"],
        },
      },
    } as KovaConfig;
    loadConfig.mockReturnValue(cfg);

    try {
      await runPluginsCommand(["plugins", "install", pluginId]);

      const writtenConfig = writeConfigFile.mock.calls.at(-1)?.[0] as KovaConfig;
      expect(writtenConfig.plugins?.entries?.[pluginId]).toBeUndefined();
      expect(writtenConfig.plugins?.load?.paths).toEqual(
        expect.arrayContaining(["/existing/plugin", pluginRoot]),
      );
      expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
        [pluginId]: expect.objectContaining({
          source: "path",
          sourcePath: pluginRoot,
          installPath: pluginRoot,
        }),
      });
      expect(enablePluginInConfig).not.toHaveBeenCalled();
      expect(applyExclusiveSlotSelection).not.toHaveBeenCalled();
      expect(runtimeLogs.some((line) => line.includes("requires configuration first"))).toBe(true);
    } finally {
      if (previousBundledDir === undefined) {
        delete process.env.KOVA_BUNDLED_PLUGINS_DIR;
      } else {
        process.env.KOVA_BUNDLED_PLUGINS_DIR = previousBundledDir;
      }
      fs.rmSync(bundledRoot, { recursive: true, force: true });
    }
  });

  it("passes force through as overwrite mode for KovaHub installs", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");

    loadConfig.mockReturnValue(cfg);
    parseKovaHubPluginSpec.mockReturnValue({ name: "demo" });
    installPluginFromKovaHub.mockResolvedValue(
      createKovaHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "official",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(enabledCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "kovahub:demo", "--force"]);

    expect(installPluginFromKovaHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "kovahub:demo",
        mode: "update",
      }),
    );
  });

  it("keeps explicit KovaHub versions pinned in install records", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");

    loadConfig.mockReturnValue(cfg);
    parseKovaHubPluginSpec.mockReturnValue({ name: "demo", version: "1.2.3" });
    installPluginFromKovaHub.mockResolvedValue(
      createKovaHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "official",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "kovahub:demo@1.2.3"]);

    expect(installPluginFromKovaHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "kovahub:demo@1.2.3",
      }),
    );
    expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
      demo: expect.objectContaining({
        source: "kovahub",
        spec: "kovahub:demo@1.2.3",
        installPath: cliInstallPath("demo"),
        version: "1.2.3",
        kovahubPackage: "demo",
      }),
    });
  });

  it("prefers KovaHub before npm for bare plugin specs", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");
    loadConfig.mockReturnValue(cfg);
    installPluginFromKovaHub.mockResolvedValue(
      createKovaHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3",
        channel: "community",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "demo"]);

    expect(installPluginFromKovaHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "kovahub:demo",
      }),
    );
    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
      demo: expect.objectContaining({
        source: "kovahub",
        spec: "kovahub:demo",
        installPath: cliInstallPath("demo"),
        version: "1.2.3",
        kovahubPackage: "demo",
      }),
    });
    expect(writeConfigFile).toHaveBeenCalledWith(enabledCfg);
  });

  it("keeps explicit bare KovaHub selectors in install records", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");
    loadConfig.mockReturnValue(cfg);
    installPluginFromKovaHub.mockResolvedValue(
      createKovaHubInstallResult({
        pluginId: "demo",
        packageName: "demo",
        version: "1.2.3-beta.1",
        channel: "community",
      }),
    );
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "demo@beta"]);

    expect(installPluginFromKovaHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "kovahub:demo@beta",
      }),
    );
    expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
      demo: expect.objectContaining({
        source: "kovahub",
        spec: "kovahub:demo@beta",
        version: "1.2.3-beta.1",
        kovahubPackage: "demo",
      }),
    });
  });

  it("falls back to npm when KovaHub does not have the package", async () => {
    primeNpmPluginFallback();

    await runPluginsCommand(["plugins", "install", "demo"]);

    expect(installPluginFromKovaHub).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "kovahub:demo",
      }),
    );
    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "demo",
      }),
    );
  });

  it("installs directly from npm when npm: prefix is used", async () => {
    const cfg = createEmptyPluginConfig();
    const enabledCfg = createEnabledPluginConfig("demo");

    loadConfig.mockReturnValue(cfg);
    installPluginFromNpmSpec.mockResolvedValue(createNpmPluginInstallResult("demo"));
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(enabledCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    await runPluginsCommand(["plugins", "install", "npm:demo"]);

    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "demo",
        mode: "install",
      }),
    );
    expect(installPluginFromKovaHub).not.toHaveBeenCalled();
    expect(writePersistedInstalledPluginIndexInstallRecords).toHaveBeenCalledWith({
      demo: expect.objectContaining({
        source: "npm",
        spec: "demo",
        installPath: cliInstallPath("demo"),
      }),
    });
    expect(writeConfigFile).toHaveBeenCalledWith(enabledCfg);
  });

  it("passes npm: prefix installs through npm options without KovaHub lookup", async () => {
    const cfg = createEmptyPluginConfig();
    const enabledCfg = createEnabledPluginConfig("demo");

    loadConfig.mockReturnValue(cfg);
    installPluginFromNpmSpec.mockResolvedValue(createNpmPluginInstallResult("demo"));
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(enabledCfg);

    await runPluginsCommand([
      "plugins",
      "install",
      "npm:demo",
      "--force",
      "--dangerously-force-unsafe-install",
    ]);

    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "demo",
        mode: "update",
        dangerouslyForceUnsafeInstall: true,
      }),
    );
    expect(installPluginFromKovaHub).not.toHaveBeenCalled();
  });

  it("reports npm install failures without trying KovaHub when npm: prefix is used", async () => {
    loadConfig.mockReturnValue({} as KovaConfig);
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "npm install failed",
    });
    installHooksFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "package.json missing kova.hooks",
    });

    await expect(runPluginsCommand(["plugins", "install", "npm:demo"])).rejects.toThrow(
      "__exit__:1",
    );

    expect(installPluginFromKovaHub).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain("npm install failed");
  });

  it("does not resolve npm: prefixed bundled plugin ids through bundled installs", async () => {
    loadConfig.mockReturnValue({ plugins: { load: { paths: [] } } } as KovaConfig);
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "Package not found on npm: memory-lancedb.",
      code: "npm_package_not_found",
    });
    installHooksFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "package.json missing kova.hooks",
    });

    await expect(runPluginsCommand(["plugins", "install", "npm:memory-lancedb"])).rejects.toThrow(
      "__exit__:1",
    );

    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "memory-lancedb",
      }),
    );
    expect(installPluginFromKovaHub).not.toHaveBeenCalled();
    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain("Package not found on npm: memory-lancedb.");
  });

  it("rejects empty npm: prefix installs before resolver lookup", async () => {
    loadConfig.mockReturnValue({} as KovaConfig);

    await expect(runPluginsCommand(["plugins", "install", "npm:"])).rejects.toThrow("__exit__:1");

    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(installPluginFromKovaHub).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain("unsupported npm: spec: missing package");
  });

  it("passes dangerous force unsafe install to marketplace installs", async () => {
    await expect(
      runPluginsCommand([
        "plugins",
        "install",
        "alpha",
        "--marketplace",
        "local/repo",
        "--dangerously-force-unsafe-install",
      ]),
    ).rejects.toThrow("__exit__:1");

    expect(installPluginFromMarketplace).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "local/repo",
        plugin: "alpha",
        dangerouslyForceUnsafeInstall: true,
      }),
    );
  });

  it("passes dangerous force unsafe install to npm installs", async () => {
    primeNpmPluginFallback();

    await runPluginsCommand(["plugins", "install", "demo", "--dangerously-force-unsafe-install"]);

    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "demo",
        dangerouslyForceUnsafeInstall: true,
      }),
    );
  });

  it("passes dangerous force unsafe install to linked path probe installs", async () => {
    const cfg = {
      plugins: {
        entries: {},
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kova-plugin-link-"));

    loadConfig.mockReturnValue(cfg);
    installPluginFromPath.mockResolvedValueOnce({
      ok: true,
      pluginId: "demo",
      targetDir: tmpRoot,
      version: "1.2.3",
      extensions: ["./dist/index.js"],
    });
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(enabledCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    try {
      await runPluginsCommand([
        "plugins",
        "install",
        tmpRoot,
        "--link",
        "--dangerously-force-unsafe-install",
      ]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }

    expect(installPluginFromPath).toHaveBeenCalledWith(
      expect.objectContaining({
        path: tmpRoot,
        dryRun: true,
        dangerouslyForceUnsafeInstall: true,
      }),
    );
  });

  it("passes dangerous force unsafe install to linked hook-pack probe fallback", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kova-hook-link-"));
    primeHookPackPathFallback({
      tmpRoot,
      pluginInstallError: "plugin install probe failed",
    });

    try {
      await runPluginsCommand([
        "plugins",
        "install",
        tmpRoot,
        "--link",
        "--dangerously-force-unsafe-install",
      ]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }

    expect(installHooksFromPath).toHaveBeenCalledWith(
      expect.objectContaining({
        path: tmpRoot,
        dryRun: true,
        dangerouslyForceUnsafeInstall: true,
      }),
    );
  });

  it("does not fall back to hook pack for linked path when a no-flag security scan blocks", async () => {
    const localPluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-link-plugin-"));
    const pluginInstallError = "plugin blocked by security scan";

    loadConfig.mockReturnValue({} as KovaConfig);
    installPluginFromPath.mockResolvedValue({
      ok: false,
      error: pluginInstallError,
      code: "security_scan_blocked",
    });

    try {
      await expect(
        runPluginsCommand(["plugins", "install", localPluginDir, "--link"]),
      ).rejects.toThrow("__exit__:1");
    } finally {
      fs.rmSync(localPluginDir, { recursive: true, force: true });
    }

    expect(installHooksFromPath).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain(pluginInstallError);
    expect(runtimeErrors.at(-1)).not.toContain("Also not a valid hook pack");
  });

  it("passes dangerous force unsafe install to local hook-pack fallback installs", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kova-hook-install-"));
    primeHookPackPathFallback({
      tmpRoot,
      pluginInstallError: "plugin install failed",
    });

    try {
      await runPluginsCommand([
        "plugins",
        "install",
        tmpRoot,
        "--dangerously-force-unsafe-install",
      ]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }

    expect(installHooksFromPath).toHaveBeenCalledWith(
      expect.objectContaining({
        path: tmpRoot,
        mode: "install",
        dangerouslyForceUnsafeInstall: true,
      }),
    );
  });
  it("passes force through as overwrite mode for npm installs", async () => {
    primeNpmPluginFallback();

    await runPluginsCommand(["plugins", "install", "demo", "--force"]);

    expect(installPluginFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "demo",
        mode: "update",
      }),
    );
  });

  it("suggests update or --force when npm plugin install target already exists", async () => {
    loadConfig.mockReturnValue({} as KovaConfig);
    mockKovaHubPackageNotFound("@example/lossless-claw");
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "plugin already exists: /home/kova/.kova/extensions/lossless-claw (delete it first)",
    });
    installHooksFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "package.json missing kova.hooks",
    });

    await expect(
      runPluginsCommand(["plugins", "install", "@example/lossless-claw"]),
    ).rejects.toThrow("__exit__:1");

    expect(runtimeErrors.at(-1)).toContain(
      "Use `kova plugins update <id-or-npm-spec>` to upgrade the tracked plugin, or rerun install with `--force` to replace it.",
    );
    expect(runtimeErrors.at(-1)).not.toContain("Also not a valid hook pack");
  });

  it("passes the install logger to the --link dry-run probe", async () => {
    const localPluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-link-plugin-"));
    const cfg = {
      plugins: {
        entries: {},
        load: {
          paths: [],
        },
      },
    } as KovaConfig;
    const enabledCfg = createEnabledPluginConfig("demo");

    loadConfig.mockReturnValue(cfg);
    installPluginFromPath.mockImplementation(async (...args: unknown[]) => {
      const [params] = args as [
        {
          logger?: { warn?: (message: string) => void };
          path: string;
          dryRun?: boolean;
          dangerouslyForceUnsafeInstall?: boolean;
        },
      ];
      params.logger?.warn?.(
        'WARNING: Plugin "demo" forced despite dangerous code patterns via --dangerously-force-unsafe-install: index.js:1',
      );
      return {
        ok: true,
        pluginId: "demo",
        targetDir: localPluginDir,
        version: "1.0.0",
        extensions: [],
      };
    });
    enablePluginInConfig.mockReturnValue({ config: enabledCfg });
    recordPluginInstall.mockReturnValue(enabledCfg);
    applyExclusiveSlotSelection.mockReturnValue({
      config: enabledCfg,
      warnings: [],
    });

    try {
      await runPluginsCommand([
        "plugins",
        "install",
        localPluginDir,
        "--link",
        "--dangerously-force-unsafe-install",
      ]);
    } finally {
      fs.rmSync(localPluginDir, { recursive: true, force: true });
    }

    expect(installPluginFromPath).toHaveBeenCalledWith(
      expect.objectContaining({
        path: localPluginDir,
        dryRun: true,
        dangerouslyForceUnsafeInstall: true,
        logger: expect.objectContaining({
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
      }),
    );
    expect(
      runtimeLogs.some((line) =>
        line.includes(
          "forced despite dangerous code patterns via --dangerously-force-unsafe-install",
        ),
      ),
    ).toBe(true);
  });

  it("does not fall back to hook pack for local path when a no-flag security scan fails", async () => {
    const localPluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-local-plugin-"));
    const pluginInstallError = "plugin security scan failed";

    loadConfig.mockReturnValue({} as KovaConfig);
    installPluginFromPath.mockResolvedValue({
      ok: false,
      error: pluginInstallError,
      code: "security_scan_failed",
    });

    try {
      await expect(runPluginsCommand(["plugins", "install", localPluginDir])).rejects.toThrow(
        "__exit__:1",
      );
    } finally {
      fs.rmSync(localPluginDir, { recursive: true, force: true });
    }

    expect(installHooksFromPath).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain(pluginInstallError);
    expect(runtimeErrors.at(-1)).not.toContain("Also not a valid hook pack");
  });

  it("does not fall back to hook pack for local path when dangerous force unsafe install is set", async () => {
    const localPluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-local-plugin-"));
    const cfg = {} as KovaConfig;
    const pluginInstallError = "plugin blocked by security scan";

    loadConfig.mockReturnValue(cfg);
    installPluginFromPath.mockResolvedValue({
      ok: false,
      error: pluginInstallError,
      code: "security_scan_blocked",
    });

    try {
      await expect(
        runPluginsCommand([
          "plugins",
          "install",
          localPluginDir,
          "--dangerously-force-unsafe-install",
        ]),
      ).rejects.toThrow("__exit__:1");
    } finally {
      fs.rmSync(localPluginDir, { recursive: true, force: true });
    }

    expect(installHooksFromPath).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain(pluginInstallError);
  });

  it("does not fall back to hook pack for local path when security scan fails under dangerous force unsafe install", async () => {
    const localPluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-local-plugin-"));
    const cfg = {} as KovaConfig;
    const pluginInstallError = "plugin security scan failed";

    loadConfig.mockReturnValue(cfg);
    installPluginFromPath.mockResolvedValue({
      ok: false,
      error: pluginInstallError,
      code: "security_scan_failed",
    });

    try {
      await expect(
        runPluginsCommand([
          "plugins",
          "install",
          localPluginDir,
          "--dangerously-force-unsafe-install",
        ]),
      ).rejects.toThrow("__exit__:1");
    } finally {
      fs.rmSync(localPluginDir, { recursive: true, force: true });
    }

    expect(installHooksFromPath).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain(pluginInstallError);
  });

  it("does not fall back to hook pack for npm installs when dangerous force unsafe install is set", async () => {
    const cfg = {} as KovaConfig;
    const pluginInstallError = "plugin blocked by security scan";

    loadConfig.mockReturnValue(cfg);
    installPluginFromKovaHub.mockResolvedValue({
      ok: false,
      error: "KovaHub /api/v1/packages/demo failed (404): Package not found",
      code: "package_not_found",
    });
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: pluginInstallError,
      code: "security_scan_blocked",
    });

    await expect(
      runPluginsCommand(["plugins", "install", "demo", "--dangerously-force-unsafe-install"]),
    ).rejects.toThrow("__exit__:1");

    expect(installHooksFromNpmSpec).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain(pluginInstallError);
  });

  it("does not fall back to hook pack for npm installs when a no-flag security scan blocks", async () => {
    primeBlockedNpmPluginInstall({
      spec: "@acme/unsafe-plugin",
      pluginId: "unsafe-plugin",
    });

    await expect(runPluginsCommand(["plugins", "install", "@acme/unsafe-plugin"])).rejects.toThrow(
      "__exit__:1",
    );

    expect(installHooksFromNpmSpec).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain('Plugin "unsafe-plugin" installation blocked');
    expect(runtimeErrors.at(-1)).not.toContain("Also not a valid hook pack");
  });

  it("does not fall back to hook pack for npm installs when security scan fails under dangerous force unsafe install", async () => {
    const cfg = {} as KovaConfig;
    const pluginInstallError = "plugin security scan failed";

    loadConfig.mockReturnValue(cfg);
    installPluginFromKovaHub.mockResolvedValue({
      ok: false,
      error: "KovaHub /api/v1/packages/demo failed (404): Package not found",
      code: "package_not_found",
    });
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: pluginInstallError,
      code: "security_scan_failed",
    });

    await expect(
      runPluginsCommand(["plugins", "install", "demo", "--dangerously-force-unsafe-install"]),
    ).rejects.toThrow("__exit__:1");

    expect(installHooksFromNpmSpec).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain(pluginInstallError);
  });

  it("still falls back to local hook pack when dangerous force unsafe install is set for non-security errors", async () => {
    const localHookDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-local-hook-pack-"));
    const cfg = {} as KovaConfig;
    const installedCfg = {
      hooks: {
        internal: {
          installs: {
            "demo-hooks": {
              source: "path",
              sourcePath: localHookDir,
            },
          },
        },
      },
    } as KovaConfig;

    loadConfig.mockReturnValue(cfg);
    installPluginFromPath.mockResolvedValue({
      ok: false,
      error: "package.json missing kova.plugin.json",
      code: "missing_kova_extensions",
    });
    installHooksFromPath.mockResolvedValue({
      ok: true,
      hookPackId: "demo-hooks",
      hooks: ["command-audit"],
      targetDir: "/tmp/hooks/demo-hooks",
      version: "1.2.3",
    });
    recordHookInstall.mockReturnValue(installedCfg);

    try {
      await runPluginsCommand([
        "plugins",
        "install",
        localHookDir,
        "--dangerously-force-unsafe-install",
      ]);
    } finally {
      fs.rmSync(localHookDir, { recursive: true, force: true });
    }

    expect(installHooksFromPath).toHaveBeenCalledWith(
      expect.objectContaining({
        path: localHookDir,
      }),
    );
    expect(runtimeLogs.some((line) => line.includes("Installed hook pack: demo-hooks"))).toBe(true);
  });

  it("still falls back to npm hook pack when dangerous force unsafe install is set for non-security errors", async () => {
    const cfg = {} as KovaConfig;
    const installedCfg = {
      hooks: {
        internal: {
          installs: {
            "demo-hooks": {
              source: "npm",
              spec: "@acme/demo-hooks@1.2.3",
            },
          },
        },
      },
    } as KovaConfig;

    loadConfig.mockReturnValue(cfg);
    installPluginFromKovaHub.mockResolvedValue({
      ok: false,
      error: "KovaHub /api/v1/packages/@acme/demo-hooks failed (404): Package not found",
      code: "package_not_found",
    });
    installPluginFromNpmSpec.mockResolvedValue({
      ok: false,
      error: "package.json missing kova.plugin.json",
      code: "missing_kova_extensions",
    });
    installHooksFromNpmSpec.mockResolvedValue({
      ok: true,
      hookPackId: "demo-hooks",
      hooks: ["command-audit"],
      targetDir: "/tmp/hooks/demo-hooks",
      version: "1.2.3",
      npmResolution: {
        name: "@acme/demo-hooks",
        spec: "@acme/demo-hooks@1.2.3",
        integrity: "sha256-demo",
      },
    });
    recordHookInstall.mockReturnValue(installedCfg);

    await runPluginsCommand([
      "plugins",
      "install",
      "@acme/demo-hooks",
      "--dangerously-force-unsafe-install",
    ]);

    expect(installHooksFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "@acme/demo-hooks",
      }),
    );
    expect(runtimeLogs.some((line) => line.includes("Installed hook pack: demo-hooks"))).toBe(true);
  });

  it("does not fall back to npm when KovaHub rejects a real package", async () => {
    installPluginFromKovaHub.mockResolvedValue({
      ok: false,
      error: 'Use "kova skills install demo" instead.',
      code: "skill_package",
    });

    await expect(runPluginsCommand(["plugins", "install", "demo"])).rejects.toThrow("__exit__:1");

    expect(installPluginFromNpmSpec).not.toHaveBeenCalled();
    expect(runtimeErrors.at(-1)).toContain('Use "kova skills install demo" instead.');
  });

  it("falls back to installing hook packs from npm specs", async () => {
    const { installedCfg } = primeHookPackNpmFallback();

    await runPluginsCommand(["plugins", "install", "@acme/demo-hooks"]);

    expect(installHooksFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "@acme/demo-hooks",
      }),
    );
    expect(recordHookInstall).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        hookId: "demo-hooks",
        hooks: ["command-audit"],
      }),
    );
    expect(writeConfigFile).toHaveBeenCalledWith(installedCfg);
    expect(runtimeLogs.some((line) => line.includes("Installed hook pack: demo-hooks"))).toBe(true);
  });

  it("passes force through as overwrite mode for hook-pack npm fallback installs", async () => {
    primeHookPackNpmFallback();

    await runPluginsCommand(["plugins", "install", "@acme/demo-hooks", "--force"]);

    expect(installHooksFromNpmSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "@acme/demo-hooks",
        mode: "update",
      }),
    );
  });
});
