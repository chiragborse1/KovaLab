import { describe, expect, it } from "vitest";
import { resolveLegacyDefaultAgentWorkspaceDir } from "../agents/workspace-default.js";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  applySettingsToggle,
  buildSettingsDashboardRows,
  findSettingsRowIndex,
  renderSettingsDashboard,
} from "./settings.js";

describe("settings dashboard", () => {
  it("summarizes the main onboarding surfaces", () => {
    const cfg: OpenClawConfig = {
      agents: {
        defaults: {
          model: { primary: "openai/gpt-5.5" },
          workspace: "~/.kova/workspace",
          memorySearch: { enabled: true },
        },
      },
      gateway: { mode: "local", port: 18789, auth: { mode: "token" } },
      channels: { telegram: { enabled: true } },
      tools: { web: { search: { enabled: true, provider: "brave" } } },
      browser: { enabled: true },
      messages: { tts: { auto: "off" } },
      plugins: { entries: { "memory-core": { enabled: true } } },
      skills: { allow: ["github"] },
      ui: { seamColor: "#ff710e" },
    };

    const rows = buildSettingsDashboardRows(cfg);

    expect(rows.map((row) => row.label)).toEqual([
      "Provider",
      "Model",
      "Workspace",
      "Gateway",
      "Channels",
      "Memory",
      "Browser Tools",
      "Voice",
      "Web Search",
      "Skills",
      "Plugins",
      "Background Service",
      "Health Check",
      "Theme",
      "Full Setup",
      "Finish",
    ]);
    expect(rows.find((row) => row.id === "provider")?.value).toBe("openai");
    expect(rows.find((row) => row.id === "model")?.value).toBe("gpt-5.5");
    expect(rows.find((row) => row.id === "channels")?.value).toBe("1 configured");
    expect(rows.find((row) => row.id === "web")?.value).toBe("brave");
    expect(rows.find((row) => row.id === "provider")?.status?.text).toBe("✓ Connected");
    expect(rows.find((row) => row.id === "plugins")?.status?.text).toBe("✓ 1 Active");
  });

  it("shows the Kova workspace when config still has the legacy default workspace", () => {
    const rows = buildSettingsDashboardRows({
      agents: {
        defaults: {
          workspace: resolveLegacyDefaultAgentWorkspaceDir(),
        },
      },
    });

    expect(rows.find((row) => row.id === "workspace")?.value).toBe("~/.kova/workspace");
  });

  it("toggles safe boolean settings without touching unrelated config", () => {
    const cfg: OpenClawConfig = {
      agents: { defaults: { memorySearch: { enabled: true } } },
      browser: { enabled: true, defaultProfile: "chrome" },
      messages: { tts: { auto: "off", provider: "openai" } },
    };

    const withoutMemory = applySettingsToggle(cfg, "memory");
    const withoutBrowser = applySettingsToggle(cfg, "browser");
    const withVoice = applySettingsToggle(cfg, "voice");

    expect(withoutMemory.agents?.defaults?.memorySearch?.enabled).toBe(false);
    expect(withoutBrowser.browser).toEqual({ enabled: false, defaultProfile: "chrome" });
    expect(withVoice.messages?.tts).toMatchObject({ auto: "always", provider: "openai" });
  });

  it("finds settings rows from slash-search queries", () => {
    const rows = buildSettingsDashboardRows({});

    expect(rows[findSettingsRowIndex(rows, "/gateway")]?.id).toBe("gateway");
    expect(rows[findSettingsRowIndex(rows, "browser")]?.id).toBe("browser");
  });

  it("renders the keyboard help and status column", () => {
    const rows = buildSettingsDashboardRows({});
    const output = renderSettingsDashboard({ rows, selectedIndex: 0, searchQuery: "gateway" });

    expect(output).toContain("Kova Settings");
    expect(output).toContain("[Enter] Edit");
    expect(output).toContain("[Space] Toggle");
    expect(output).toContain("[/] Search");
    expect(output).toContain("Search: /gateway");
  });
});
