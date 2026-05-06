import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.openclaw.js";
import {
  applySettingsToggle,
  buildSettingsDashboardRows,
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
    ]);
    expect(rows.find((row) => row.id === "provider")?.value).toBe("openai");
    expect(rows.find((row) => row.id === "model")?.value).toBe("gpt-5.5");
    expect(rows.find((row) => row.id === "channels")?.value).toBe("1 configured");
    expect(rows.find((row) => row.id === "web")?.value).toBe("brave");
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

  it("renders the keyboard help and dirty state", () => {
    const rows = buildSettingsDashboardRows({});
    const output = renderSettingsDashboard({ rows, selectedIndex: 0, dirty: true });

    expect(output).toContain("Kova Settings");
    expect(output).toContain("[Enter] Edit");
    expect(output).toContain("[Space] Toggle");
    expect(output).toContain("Unsaved changes");
  });
});
