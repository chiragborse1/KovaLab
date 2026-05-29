import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __testing as acpRuntimeTesting,
  registerAcpRuntimeBackend,
} from "../../acp/runtime/registry.js";
import type { KovaConfig } from "../../config/config.js";
import type { PluginManifestRegistry } from "../../plugins/manifest-registry.js";
import { createTrackedTempDirs } from "../../test-utils/tracked-temp-dirs.js";

const hoisted = vi.hoisted(() => {
  const loadManifestRegistry = vi.fn();
  return {
    loadPluginManifestRegistryForInstalledIndex: loadManifestRegistry,
    loadPluginManifestRegistryForPluginRegistry: loadManifestRegistry,
    loadPluginRegistrySnapshot: vi.fn(() => ({ plugins: [] })),
  };
});

vi.mock("../../plugins/manifest-registry-installed.js", () => ({
  loadPluginManifestRegistryForInstalledIndex: hoisted.loadPluginManifestRegistryForInstalledIndex,
}));

vi.mock("../../plugins/plugin-registry.js", () => ({
  loadPluginManifestRegistryForPluginRegistry: hoisted.loadPluginManifestRegistryForPluginRegistry,
  loadPluginRegistrySnapshot: hoisted.loadPluginRegistrySnapshot,
}));

let resolvePluginSkillDirs: typeof import("./plugin-skills.js").resolvePluginSkillDirs;
let pluginSkillsTesting: typeof import("./plugin-skills.js").__testing;

const tempDirs = createTrackedTempDirs();

function buildRegistry(params: { acpxRoot: string; helperRoot: string }): PluginManifestRegistry {
  return {
    diagnostics: [],
    plugins: [
      {
        id: "acpx",
        name: "ACPX Runtime",
        channels: [],
        providers: [],
        cliBackends: [],
        skills: ["./skills"],
        hooks: [],
        origin: "workspace",
        rootDir: params.acpxRoot,
        source: params.acpxRoot,
        manifestPath: path.join(params.acpxRoot, "kova.plugin.json"),
      },
      {
        id: "helper",
        name: "Helper",
        channels: [],
        providers: [],
        cliBackends: [],
        skills: ["./skills"],
        hooks: [],
        origin: "workspace",
        rootDir: params.helperRoot,
        source: params.helperRoot,
        manifestPath: path.join(params.helperRoot, "kova.plugin.json"),
      },
    ],
  };
}

function createSinglePluginRegistry(params: {
  pluginRoot: string;
  skills: string[];
  format?: "kova" | "bundle";
  legacyPluginIds?: string[];
}): PluginManifestRegistry {
  return {
    diagnostics: [],
    plugins: [
      {
        id: "helper",
        name: "Helper",
        format: params.format,
        channels: [],
        providers: [],
        cliBackends: [],
        legacyPluginIds: params.legacyPluginIds,
        skills: params.skills,
        hooks: [],
        origin: "workspace",
        rootDir: params.pluginRoot,
        source: params.pluginRoot,
        manifestPath: path.join(params.pluginRoot, "kova.plugin.json"),
      },
    ],
  };
}

async function setupAcpxAndHelperRegistry() {
  const workspaceDir = await tempDirs.make("kova-");
  const acpxRoot = await tempDirs.make("kova-acpx-plugin-");
  const helperRoot = await tempDirs.make("kova-helper-plugin-");
  await fs.mkdir(path.join(acpxRoot, "skills"), { recursive: true });
  await fs.mkdir(path.join(helperRoot, "skills"), { recursive: true });
  hoisted.loadPluginManifestRegistryForInstalledIndex.mockReturnValue(
    buildRegistry({ acpxRoot, helperRoot }),
  );
  return { workspaceDir, acpxRoot, helperRoot };
}

async function setupPluginOutsideSkills() {
  const workspaceDir = await tempDirs.make("kova-");
  const pluginRoot = await tempDirs.make("kova-plugin-");
  const outsideDir = await tempDirs.make("kova-outside-");
  const outsideSkills = path.join(outsideDir, "skills");
  return { workspaceDir, pluginRoot, outsideSkills };
}

async function resolveTestPluginSkillDirs(
  params: Omit<Parameters<typeof resolvePluginSkillDirs>[0], "pluginSkillsDir"> & {
    pluginSkillsDir?: string;
  },
) {
  const pluginSkillsDir = params.pluginSkillsDir ?? (await tempDirs.make("kova-plugin-skills-"));
  return resolvePluginSkillDirs({ ...params, pluginSkillsDir });
}

function registerHealthyAcpBackend() {
  registerAcpRuntimeBackend({
    id: "acpx",
    runtime: {
      async ensureSession(input) {
        return {
          sessionKey: input.sessionKey,
          backend: "acpx",
          runtimeSessionName: input.sessionKey,
        };
      },
      async *runTurn() {
        yield { type: "done" as const };
      },
      async cancel() {},
      async close() {},
    },
  });
}

afterEach(async () => {
  hoisted.loadPluginManifestRegistryForInstalledIndex.mockReset();
  hoisted.loadPluginRegistrySnapshot.mockReset();
  acpRuntimeTesting.resetAcpRuntimeBackendsForTests();
  await tempDirs.cleanup();
});

describe("resolvePluginSkillDirs", () => {
  beforeAll(async () => {
    const pluginSkillsModule = await import("./plugin-skills.js");
    ({ resolvePluginSkillDirs } = pluginSkillsModule);
    pluginSkillsTesting = pluginSkillsModule.__testing;
  });

  beforeEach(() => {
    hoisted.loadPluginManifestRegistryForInstalledIndex.mockReset();
    hoisted.loadPluginManifestRegistryForInstalledIndex.mockReturnValue({
      diagnostics: [],
      plugins: [],
    });
    hoisted.loadPluginRegistrySnapshot.mockReset();
    hoisted.loadPluginRegistrySnapshot.mockReturnValue({ plugins: [] });
  });

  it.each([
    {
      name: "keeps acpx plugin skills when ACP runtime is available",
      acpEnabled: true,
      backendAvailable: true,
      expectedDirs: ({ acpxRoot, helperRoot }: { acpxRoot: string; helperRoot: string }) => [
        path.resolve(acpxRoot, "skills"),
        path.resolve(helperRoot, "skills"),
      ],
    },
    {
      name: "skips acpx plugin skills when ACP is disabled",
      acpEnabled: false,
      backendAvailable: true,
      expectedDirs: ({ helperRoot }: { acpxRoot: string; helperRoot: string }) => [
        path.resolve(helperRoot, "skills"),
      ],
    },
    {
      name: "skips acpx plugin skills when no ACP runtime backend is loaded",
      acpEnabled: true,
      backendAvailable: false,
      expectedDirs: ({ helperRoot }: { acpxRoot: string; helperRoot: string }) => [
        path.resolve(helperRoot, "skills"),
      ],
    },
  ])("$name", async ({ acpEnabled, backendAvailable, expectedDirs }) => {
    const { workspaceDir, acpxRoot, helperRoot } = await setupAcpxAndHelperRegistry();
    if (backendAvailable) {
      registerHealthyAcpBackend();
    }

    const dirs = await resolveTestPluginSkillDirs({
      workspaceDir,
      config: {
        acp: { enabled: acpEnabled },
        plugins: {
          entries: {
            acpx: { enabled: true },
            helper: { enabled: true },
          },
        },
      } as KovaConfig,
    });

    expect(dirs).toEqual(expectedDirs({ acpxRoot, helperRoot }));
  });

  it("rejects plugin skill paths that escape the plugin root", async () => {
    const { workspaceDir, pluginRoot, outsideSkills } = await setupPluginOutsideSkills();
    await fs.mkdir(path.join(pluginRoot, "skills"), { recursive: true });
    await fs.mkdir(outsideSkills, { recursive: true });
    const escapePath = path.relative(pluginRoot, outsideSkills);

    hoisted.loadPluginManifestRegistryForInstalledIndex.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        skills: ["./skills", escapePath],
      }),
    );

    const dirs = await resolveTestPluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            helper: { enabled: true },
          },
        },
      } as KovaConfig,
    });

    expect(dirs).toEqual([path.resolve(pluginRoot, "skills")]);
  });

  it("rejects plugin skill symlinks that resolve outside plugin root", async () => {
    const { workspaceDir, pluginRoot, outsideSkills } = await setupPluginOutsideSkills();
    const linkPath = path.join(pluginRoot, "skills-link");
    await fs.mkdir(outsideSkills, { recursive: true });
    await fs.symlink(
      outsideSkills,
      linkPath,
      process.platform === "win32" ? ("junction" as const) : ("dir" as const),
    );

    hoisted.loadPluginManifestRegistryForInstalledIndex.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        skills: ["./skills-link"],
      }),
    );

    const dirs = await resolveTestPluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            helper: { enabled: true },
          },
        },
      } as KovaConfig,
    });

    expect(dirs).toEqual([]);
  });

  it("resolves Claude bundle command roots through the normal plugin skill path", async () => {
    const workspaceDir = await tempDirs.make("kova-");
    const pluginRoot = await tempDirs.make("kova-claude-bundle-");
    await fs.mkdir(path.join(pluginRoot, "commands"), { recursive: true });
    await fs.mkdir(path.join(pluginRoot, "skills"), { recursive: true });

    hoisted.loadPluginManifestRegistryForInstalledIndex.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        format: "bundle",
        skills: ["./skills", "./commands"],
      }),
    );

    const dirs = await resolveTestPluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            helper: { enabled: true },
          },
        },
      } as KovaConfig,
    });

    expect(dirs).toEqual([
      path.resolve(pluginRoot, "skills"),
      path.resolve(pluginRoot, "commands"),
    ]);
  });

  it("resolves enabled plugin skills through legacy manifest aliases", async () => {
    const workspaceDir = await tempDirs.make("kova-");
    const pluginRoot = await tempDirs.make("kova-legacy-plugin-");
    await fs.mkdir(path.join(pluginRoot, "skills"), { recursive: true });

    hoisted.loadPluginManifestRegistryForInstalledIndex.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        skills: ["./skills"],
        legacyPluginIds: ["helper-legacy"],
      }),
    );

    const dirs = await resolveTestPluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            "helper-legacy": { enabled: true },
          },
        },
      } as KovaConfig,
    });

    expect(dirs).toEqual([path.resolve(pluginRoot, "skills")]);
  });

  it("publishes generated plugin skill symlinks and removes stale generated entries", async () => {
    const pluginSkillsDir = await tempDirs.make("kova-plugin-skills-");
    const skillParent = await tempDirs.make("kova-plugin-skill-parent-");
    const currentSkill = path.join(skillParent, "current-skill");
    const staleSkill = path.join(skillParent, "stale-skill");
    await fs.mkdir(staleSkill, { recursive: true });
    await fs.symlink(
      staleSkill,
      path.join(pluginSkillsDir, "stale-skill"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await fs.mkdir(currentSkill, { recursive: true });
    await fs.writeFile(
      path.join(currentSkill, "SKILL.md"),
      "---\nname: current-skill\ndescription: Current plugin skill\n---\n",
      "utf8",
    );

    pluginSkillsTesting.publishPluginSkills([currentSkill], { pluginSkillsDir });

    const currentLink = path.join(pluginSkillsDir, "current-skill");
    expect(fsSync.existsSync(currentLink)).toBe(true);
    expect(fsSync.existsSync(path.join(pluginSkillsDir, "stale-skill"))).toBe(false);
  });

  it("expands plugin skill container directories when publishing generated links", async () => {
    const pluginSkillsDir = await tempDirs.make("kova-plugin-skills-");
    const containerDir = await tempDirs.make("kova-plugin-skill-container-");
    const browserSkill = path.join(containerDir, "browser");
    const memorySkill = path.join(containerDir, "memory");
    await fs.mkdir(browserSkill, { recursive: true });
    await fs.mkdir(memorySkill, { recursive: true });
    await fs.writeFile(
      path.join(browserSkill, "SKILL.md"),
      "---\nname: browser\ndescription: Browser skill\n---\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(memorySkill, "SKILL.md"),
      "---\nname: memory\ndescription: Memory skill\n---\n",
      "utf8",
    );

    pluginSkillsTesting.publishPluginSkills([containerDir], { pluginSkillsDir });

    expect(fsSync.existsSync(path.join(pluginSkillsDir, "browser"))).toBe(true);
    expect(fsSync.existsSync(path.join(pluginSkillsDir, "memory"))).toBe(true);
  });
});
