import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "../../config/home-env.test-harness.js";
import { createCommandWorkspaceHarness } from "./commands-filesystem.test-support.js";
import { handlePluginsCommand } from "./commands-plugins.js";
import { buildPluginsCommandParams } from "./commands.test-harness.js";

const { installPluginFromPathMock, installPluginFromKovaHubMock, persistPluginInstallMock } =
  vi.hoisted(() => ({
    installPluginFromPathMock: vi.fn(),
    installPluginFromKovaHubMock: vi.fn(),
    persistPluginInstallMock: vi.fn(),
  }));

vi.mock("../../plugins/install.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/install.js")>(
    "../../plugins/install.js",
  );
  return {
    ...actual,
    installPluginFromPath: installPluginFromPathMock,
  };
});

vi.mock("../../plugins/kovahub.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/kovahub.js")>(
    "../../plugins/kovahub.js",
  );
  return {
    ...actual,
    installPluginFromKovaHub: installPluginFromKovaHubMock,
  };
});

vi.mock("../../cli/plugins-install-persist.js", () => ({
  persistPluginInstall: persistPluginInstallMock,
}));

const workspaceHarness = createCommandWorkspaceHarness("kova-command-plugins-install-");

function buildPluginsParams(commandBodyNormalized: string, workspaceDir: string) {
  return buildPluginsCommandParams({
    commandBodyNormalized,
    workspaceDir,
    gatewayClientScopes: ["operator.admin", "operator.write", "operator.pairing"],
  });
}

describe("handleCommands /plugins install", () => {
  afterEach(async () => {
    installPluginFromPathMock.mockReset();
    installPluginFromKovaHubMock.mockReset();
    persistPluginInstallMock.mockReset();
    await workspaceHarness.cleanupWorkspaces();
  });

  it("installs a plugin from a local path", async () => {
    installPluginFromPathMock.mockResolvedValue({
      ok: true,
      pluginId: "path-install-plugin",
      targetDir: "/tmp/path-install-plugin",
      version: "0.0.1",
      extensions: ["index.js"],
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("kova-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const pluginDir = path.join(workspaceDir, "fixtures", "path-install-plugin");
      await fs.mkdir(pluginDir, { recursive: true });

      const params = buildPluginsParams(`/plugins install ${pluginDir}`, workspaceDir);
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "path-install-plugin"');
      expect(installPluginFromPathMock).toHaveBeenCalledWith(
        expect.objectContaining({
          path: pluginDir,
        }),
      );
      expect(persistPluginInstallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: "path-install-plugin",
          install: expect.objectContaining({
            source: "path",
            sourcePath: pluginDir,
            installPath: "/tmp/path-install-plugin",
            version: "0.0.1",
          }),
        }),
      );
    });
  });

  it("installs from an explicit kovahub: spec", async () => {
    installPluginFromKovaHubMock.mockResolvedValue({
      ok: true,
      pluginId: "kovahub-demo",
      targetDir: "/tmp/kovahub-demo",
      version: "1.2.3",
      extensions: ["index.js"],
      packageName: "@chiragborse1/kovahub-demo",
      kovahub: {
        source: "kovahub",
        kovahubUrl: "https://kovahub.ai",
        kovahubPackage: "@chiragborse1/kovahub-demo",
        kovahubFamily: "code-plugin",
        kovahubChannel: "official",
        version: "1.2.3",
        integrity: "sha512-demo",
        resolvedAt: "2026-03-22T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("kova-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildPluginsParams(
        "/plugins install kovahub:@chiragborse1/kovahub-demo@1.2.3",
        workspaceDir,
      );
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "kovahub-demo"');
      expect(installPluginFromKovaHubMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: "kovahub:@chiragborse1/kovahub-demo@1.2.3",
        }),
      );
      expect(persistPluginInstallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: "kovahub-demo",
          install: expect.objectContaining({
            source: "kovahub",
            spec: "kovahub:@chiragborse1/kovahub-demo@1.2.3",
            installPath: "/tmp/kovahub-demo",
            version: "1.2.3",
            integrity: "sha512-demo",
            kovahubPackage: "@chiragborse1/kovahub-demo",
            kovahubChannel: "official",
          }),
        }),
      );
    });
  });

  it("treats /plugin add as an install alias", async () => {
    installPluginFromKovaHubMock.mockResolvedValue({
      ok: true,
      pluginId: "alias-demo",
      targetDir: "/tmp/alias-demo",
      version: "1.0.0",
      extensions: ["index.js"],
      packageName: "@kovaai/alias-demo",
      kovahub: {
        source: "kovahub",
        kovahubUrl: "https://kovahub.ai",
        kovahubPackage: "@kovaai/alias-demo",
        kovahubFamily: "code-plugin",
        kovahubChannel: "official",
        version: "1.0.0",
        integrity: "sha512-alias",
        resolvedAt: "2026-03-23T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("kova-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildPluginsParams(
        "/plugin add kovahub:@kovaai/alias-demo@1.0.0",
        workspaceDir,
      );
      const result = await handlePluginsCommand(params, true);
      if (result === null) {
        throw new Error("expected plugin install result");
      }
      expect(result.reply?.text).toContain('Installed plugin "alias-demo"');
      expect(installPluginFromKovaHubMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: "kovahub:@kovaai/alias-demo@1.0.0",
        }),
      );
    });
  });
});
