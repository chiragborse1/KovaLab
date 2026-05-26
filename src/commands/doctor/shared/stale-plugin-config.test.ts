import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../../../config/config.js";
import type { PluginInstallRecord } from "../../../config/types.plugins.js";
import type { PluginManifestRecord } from "../../../plugins/manifest-registry.js";
import * as manifestRegistry from "../../../plugins/manifest-registry.js";
import {
  collectStalePluginConfigWarnings,
  maybeRepairStalePluginConfig,
  scanStalePluginConfig,
} from "./stale-plugin-config.js";

const installedPluginIndexMocks = vi.hoisted(() => ({
  loadInstalledPluginIndexInstallRecordsSync: vi.fn<() => Record<string, PluginInstallRecord>>(
    () => ({}),
  ),
}));

vi.mock("../../../plugins/installed-plugin-index-records.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../plugins/installed-plugin-index-records.js")>()),
  loadInstalledPluginIndexInstallRecordsSync:
    installedPluginIndexMocks.loadInstalledPluginIndexInstallRecordsSync,
}));

function manifest(id: string): PluginManifestRecord {
  return {
    id,
    channels: [],
    providers: [],
    cliBackends: [],
    skills: [],
    hooks: [],
    origin: "bundled",
    rootDir: `/plugins/${id}`,
    source: `/plugins/${id}`,
    manifestPath: `/plugins/${id}/kova.plugin.json`,
  };
}

describe("doctor stale plugin config helpers", () => {
  beforeEach(() => {
    installedPluginIndexMocks.loadInstalledPluginIndexInstallRecordsSync.mockReset();
    installedPluginIndexMocks.loadInstalledPluginIndexInstallRecordsSync.mockReturnValue({});
    vi.spyOn(manifestRegistry, "loadPluginManifestRegistry").mockReturnValue({
      plugins: [manifest("discord"), manifest("voice-call"), manifest("openai")],
      diagnostics: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds stale plugins.allow and plugins.entries refs", () => {
    const hits = scanStalePluginConfig({
      plugins: {
        allow: ["discord", "acpx"],
        entries: {
          "voice-call": { enabled: true },
          acpx: { enabled: true },
        },
      },
    } as KovaConfig);

    expect(hits).toEqual([
      {
        pluginId: "acpx",
        pathLabel: "plugins.allow",
        surface: "allow",
      },
      {
        pluginId: "acpx",
        pathLabel: "plugins.entries.acpx",
        surface: "entries",
      },
    ]);
  });

  it("removes stale plugin ids from allow and entries without changing valid refs", () => {
    const result = maybeRepairStalePluginConfig({
      plugins: {
        allow: ["discord", "acpx", "voice-call"],
        entries: {
          "voice-call": { enabled: true },
          acpx: { enabled: true },
        },
      },
    } as KovaConfig);

    expect(result.changes).toEqual([
      "- plugins.allow: removed 1 stale plugin id (acpx)",
      "- plugins.entries: removed 1 stale plugin entry (acpx)",
    ]);
    expect(result.config.plugins?.allow).toEqual(["discord", "voice-call"]);
    expect(result.config.plugins?.entries).toEqual({
      "voice-call": { enabled: true },
    });
  });

  it("formats stale plugin warnings with a doctor hint", () => {
    const warnings = collectStalePluginConfigWarnings({
      hits: [
        {
          pluginId: "acpx",
          pathLabel: "plugins.allow",
          surface: "allow",
        },
      ],
      doctorFixCommand: "kova doctor --fix",
    });

    expect(warnings).toEqual([
      expect.stringContaining('plugins.allow: stale plugin reference "acpx"'),
      expect.stringContaining('Run "kova doctor --fix"'),
    ]);
  });

  it("removes stale third-party channel config and dependent channel refs", () => {
    const result = maybeRepairStalePluginConfig({
      plugins: {
        allow: ["discord", "kova-weixin"],
        entries: {
          discord: { enabled: true },
          "kova-weixin": { enabled: true },
        },
      },
      channels: {
        "kova-weixin": {
          enabled: true,
          token: "stale",
        },
        telegram: {
          botToken: "keep",
        },
        modelByChannel: {
          openai: {
            "kova-weixin": "openai/gpt-5.4",
            telegram: "openai/gpt-5.4",
          },
        },
      },
      agents: {
        defaults: {
          heartbeat: {
            target: "kova-weixin",
            every: "30m",
          },
        },
        list: [
          {
            id: "pi",
            heartbeat: {
              target: "kova-weixin",
            },
          },
          {
            id: "ops",
            heartbeat: {
              target: "telegram",
            },
          },
        ],
      },
    } as KovaConfig);

    expect(result.changes).toEqual([
      "- plugins.allow: removed 1 stale plugin id (kova-weixin)",
      "- plugins.entries: removed 1 stale plugin entry (kova-weixin)",
      "- channels: removed 1 stale channel config (kova-weixin)",
      "- agents Pulse: removed 2 stale Pulse targets (kova-weixin)",
      "- channels.modelByChannel: removed 1 stale channel model override (kova-weixin)",
    ]);
    expect(result.config.plugins?.allow).toEqual(["discord"]);
    expect(result.config.plugins?.entries).toEqual({
      discord: { enabled: true },
    });
    expect(result.config.channels?.["kova-weixin"]).toBeUndefined();
    expect(result.config.channels?.telegram).toEqual({ botToken: "keep" });
    expect(result.config.channels?.modelByChannel).toEqual({
      openai: {
        telegram: "openai/gpt-5.4",
      },
    });
    expect(result.config.agents?.defaults?.heartbeat).toEqual({ every: "30m" });
    expect(result.config.agents?.list?.[0]?.heartbeat).toEqual({});
    expect(result.config.agents?.list?.[1]?.heartbeat).toEqual({ target: "telegram" });
  });

  it("does not remove unknown channel config without stale plugin evidence", () => {
    const cfg = {
      channels: {
        telegrm: {
          botToken: "typo",
        },
      },
    } as KovaConfig;

    expect(scanStalePluginConfig(cfg)).toEqual([]);
    expect(maybeRepairStalePluginConfig(cfg)).toEqual({ config: cfg, changes: [] });
  });

  it("uses missing persisted install records as stale channel evidence", () => {
    installedPluginIndexMocks.loadInstalledPluginIndexInstallRecordsSync.mockReturnValue({
      "kova-weixin": {
        source: "npm",
        resolvedName: "@tencent-weixin/kova-weixin",
        installedAt: "2026-04-12T00:00:00.000Z",
      },
    });

    const result = maybeRepairStalePluginConfig({
      channels: {
        "kova-weixin": {
          enabled: true,
        },
      },
    } as KovaConfig);

    expect(result.changes).toEqual(["- channels: removed 1 stale channel config (kova-weixin)"]);
    expect(result.config.channels?.["kova-weixin"]).toBeUndefined();
  });

  it("does not auto-repair stale refs while plugin discovery has errors", () => {
    vi.spyOn(manifestRegistry, "loadPluginManifestRegistry").mockReturnValue({
      plugins: [],
      diagnostics: [
        { level: "error", message: "plugin path not found: /missing", source: "/missing" },
      ],
    });

    const cfg = {
      plugins: {
        allow: ["acpx"],
        entries: {
          acpx: { enabled: true },
        },
      },
    } as KovaConfig;

    const hits = scanStalePluginConfig(cfg);
    expect(hits).toEqual([
      {
        pluginId: "acpx",
        pathLabel: "plugins.allow",
        surface: "allow",
      },
      {
        pluginId: "acpx",
        pathLabel: "plugins.entries.acpx",
        surface: "entries",
      },
    ]);

    const result = maybeRepairStalePluginConfig(cfg);
    expect(result.changes).toEqual([]);
    expect(result.config).toEqual(cfg);

    const warnings = collectStalePluginConfigWarnings({
      hits,
      doctorFixCommand: "kova doctor --fix",
      autoRepairBlocked: true,
    });
    expect(warnings[2]).toContain("Auto-removal is paused");
  });

  it("treats legacy plugin aliases as valid ids during scan and repair", () => {
    const cfg = {
      plugins: {
        allow: ["openai-codex", "acpx"],
        entries: {
          "openai-codex": { enabled: true },
          acpx: { enabled: true },
        },
      },
    } as KovaConfig;

    expect(scanStalePluginConfig(cfg)).toEqual([
      {
        pluginId: "acpx",
        pathLabel: "plugins.allow",
        surface: "allow",
      },
      {
        pluginId: "acpx",
        pathLabel: "plugins.entries.acpx",
        surface: "entries",
      },
    ]);

    const result = maybeRepairStalePluginConfig(cfg);
    expect(result.config.plugins?.allow).toEqual(["openai-codex"]);
    expect(result.config.plugins?.entries).toEqual({
      "openai-codex": { enabled: true },
    });
  });
});
