/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import { renderSkills, type SkillsProps } from "./skills.ts";

function normalizeText(node: Element | DocumentFragment): string {
  return node.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function createSkill(overrides: Partial<SkillStatusEntry> = {}): SkillStatusEntry {
  return {
    name: "Repo Skill",
    description: "Skill description",
    source: "kova-workspace",
    filePath: "/tmp/skill/SKILL.md",
    baseDir: "/tmp/skill",
    skillKey: "repo-skill",
    bundled: false,
    primaryEnv: "OPENAI_API_KEY",
    emoji: undefined,
    homepage: "https://example.com",
    always: false,
    disabled: false,
    blockedByAllowlist: false,
    eligible: true,
    requirements: {
      bins: [],
      env: [],
      config: [],
      os: [],
    },
    missing: {
      bins: [],
      env: [],
      config: [],
      os: [],
    },
    configChecks: [],
    install: [],
    ...overrides,
  };
}

function createProps(overrides: Partial<SkillsProps> = {}): SkillsProps {
  const report: SkillStatusReport = {
    workspaceDir: "/tmp/workspace",
    managedSkillsDir: "/tmp/skills",
    skills: [
      createSkill(),
      createSkill({
        name: "Browser Skill",
        description: "Needs browser binary",
        source: "kova-bundled",
        skillKey: "browser-skill",
        bundled: true,
        eligible: false,
        primaryEnv: undefined,
        requirements: { bins: ["chromium"], env: [], config: [], os: [] },
        missing: { bins: ["chromium"], env: [], config: [], os: [] },
        install: [
          { id: "brew-chromium", kind: "brew", label: "Install Chromium", bins: ["chromium"] },
        ],
      }),
      createSkill({
        name: "Disabled Skill",
        source: "kova-managed",
        skillKey: "disabled-skill",
        disabled: true,
        primaryEnv: undefined,
      }),
    ],
  };

  return {
    connected: true,
    loading: false,
    report,
    error: null,
    filter: "",
    statusFilter: "all",
    sourceFilter: "all",
    selectedKeys: [],
    edits: {},
    busyKey: null,
    messages: {},
    detailKey: null,
    kovahubQuery: "",
    kovahubResults: null,
    kovahubSearchLoading: false,
    kovahubSearchError: null,
    kovahubDetail: null,
    kovahubDetailSlug: null,
    kovahubDetailLoading: false,
    kovahubDetailError: null,
    kovahubInstallSlug: null,
    kovahubInstallMessage: null,
    onFilterChange: () => undefined,
    onStatusFilterChange: () => undefined,
    onSourceFilterChange: () => undefined,
    onSelectionChange: () => undefined,
    onRefresh: () => undefined,
    onToggle: () => undefined,
    onEdit: () => undefined,
    onSaveKey: () => undefined,
    onInstall: () => undefined,
    onDetailOpen: () => undefined,
    onDetailClose: () => undefined,
    onKovaHubQueryChange: () => undefined,
    onKovaHubDetailOpen: () => undefined,
    onKovaHubDetailClose: () => undefined,
    onKovaHubInstall: () => undefined,
    ...overrides,
  };
}

describe("renderSkills", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the management console with filters, source groups, and setup queue", () => {
    const container = document.createElement("div");
    const onStatusFilterChange = vi.fn();
    const onSourceFilterChange = vi.fn();
    const onFilterChange = vi.fn();

    render(
      renderSkills(
        createProps({
          onStatusFilterChange,
          onSourceFilterChange,
          onFilterChange,
        }),
      ),
      container,
    );

    const text = normalizeText(container);
    expect(text).toContain(
      "Manage local skills, missing requirements, API keys, and KovaHub installs.",
    );
    expect(text).toContain("Ready");
    expect(text).toContain("Needs setup");
    expect(text).toContain("Workspace Skills");
    expect(text).toContain("Built-in Skills");
    expect(text).toContain("Setup Queue");
    expect(text).toContain("Browser Skill");
    expect(text).toContain("bin:chromium");
    expect(text).toContain("kova-workspace");

    const needsSetupTab = Array.from(container.querySelectorAll(".skills-filter-tab")).find((tab) =>
      tab.textContent?.includes("Needs Setup"),
    );
    needsSetupTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onStatusFilterChange).toHaveBeenCalledWith("needs-setup");

    const builtInTab = Array.from(container.querySelectorAll(".skills-filter-tab")).find((tab) =>
      tab.textContent?.includes("Built-in"),
    );
    builtInTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSourceFilterChange).toHaveBeenCalledWith("built-in");

    const search = container.querySelector<HTMLInputElement>('input[name="skills-filter"]');
    expect(search).not.toBeNull();
    search!.value = "browser";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onFilterChange).toHaveBeenCalledWith("browser");
  });

  it("opens the inspector, toggles skills, saves API keys, and installs missing dependencies", () => {
    const container = document.createElement("div");
    const onDetailOpen = vi.fn();
    const onDetailClose = vi.fn();
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    const onSaveKey = vi.fn();
    const onInstall = vi.fn();

    render(
      renderSkills(
        createProps({
          detailKey: "repo-skill",
          edits: { "repo-skill": "sk-test" },
          onDetailOpen,
          onDetailClose,
          onToggle,
          onEdit,
          onSaveKey,
          onInstall,
        }),
      ),
      container,
    );

    const row = Array.from(container.querySelectorAll(".skills-row")).find((item) =>
      item.textContent?.includes("Browser Skill"),
    );
    row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onDetailOpen).toHaveBeenCalledWith("browser-skill");

    const inspector = container.querySelector(".skills-inspector");
    expect(inspector?.textContent).toContain("OPENAI_API_KEY");
    expect(inspector?.textContent).toContain("/tmp/skill/SKILL.md");
    expect(inspector?.textContent).toContain("https://example.com");

    const apiInput = inspector?.querySelector<HTMLInputElement>('input[type="password"]');
    expect(apiInput).not.toBeNull();
    apiInput!.value = "sk-next";
    apiInput!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onEdit).toHaveBeenCalledWith("repo-skill", "sk-next");

    const saveButton = Array.from(inspector?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Save key"),
    );
    saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSaveKey).toHaveBeenCalledWith("repo-skill");

    const closeButton = Array.from(inspector?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Close"),
    );
    closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onDetailClose).toHaveBeenCalledTimes(1);

    const toggle = row?.querySelector<HTMLInputElement>(".skill-toggle");
    toggle?.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith("browser-skill", false);

    render(
      renderSkills(
        createProps({
          detailKey: "browser-skill",
          onInstall,
        }),
      ),
      container,
    );

    const installButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".skills-inspector button"),
    ).find((button) => button.textContent?.includes("Install Chromium"));
    installButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onInstall).toHaveBeenCalledWith("browser-skill", "Browser Skill", "brew-chromium");
  });

  it("supports selection bulk actions", () => {
    const container = document.createElement("div");
    const onSelectionChange = vi.fn();
    const onToggle = vi.fn();
    const onInstall = vi.fn();

    render(
      renderSkills(
        createProps({
          selectedKeys: ["browser-skill", "disabled-skill"],
          onSelectionChange,
          onToggle,
          onInstall,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("2 selected");

    const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Clear"),
    );
    clearButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);

    const enableButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Enable",
    );
    enableButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith("browser-skill", true);
    expect(onToggle).toHaveBeenCalledWith("disabled-skill", true);

    const disableButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Disable",
    );
    disableButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledWith("browser-skill", false);
    expect(onToggle).toHaveBeenCalledWith("disabled-skill", false);

    const installButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Install missing deps"),
    );
    installButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onInstall).toHaveBeenCalledWith("browser-skill", "Browser Skill", "brew-chromium");
  });

  it("routes KovaHub search, detail, and install actions through the existing callbacks", () => {
    const container = document.createElement("div");
    const onKovaHubQueryChange = vi.fn();
    const onKovaHubDetailOpen = vi.fn();
    const onKovaHubDetailClose = vi.fn();
    const onKovaHubInstall = vi.fn();

    render(
      renderSkills(
        createProps({
          kovahubQuery: "git",
          kovahubResults: [
            {
              score: 0.95,
              slug: "github",
              displayName: "GitHub",
              summary: "GitHub integration for Kova",
              version: "1.2.3",
            },
          ],
          kovahubSearchError: "rate limited",
          kovahubInstallMessage: { kind: "success", text: "Installed github" },
          kovahubDetailSlug: "github",
          kovahubDetail: {
            skill: {
              slug: "github",
              displayName: "GitHub",
              summary: "GitHub integration for Kova",
              createdAt: 1_700_000_000,
              updatedAt: 1_700_000_100,
            },
            latestVersion: {
              version: "1.2.3",
              createdAt: 1_700_000_200,
              changelog: "Added search support",
            },
            metadata: {
              os: ["macos", "linux"],
            },
            owner: {
              displayName: "Kova",
              handle: "kovaai",
            },
          },
          onKovaHubQueryChange,
          onKovaHubDetailOpen,
          onKovaHubDetailClose,
          onKovaHubInstall,
        }),
      ),
      container,
    );

    const search = container.querySelector<HTMLInputElement>('input[name="kovahub-search"]');
    expect(search).not.toBeNull();
    search!.value = "calendar";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onKovaHubQueryChange).toHaveBeenCalledWith("calendar");

    const text = normalizeText(container);
    expect(text).toContain("rate limited");
    expect(text).toContain("Installed github");
    expect(text).toContain("GitHub integration for Kova");
    expect(text).toContain("Owner Kova (@kovaai)");
    expect(text).toContain("Latest");
    expect(text).toContain("v1.2.3");
    expect(text).toContain("Platforms");
    expect(text).toContain("macos, linux");
    expect(text).toContain("Added search support");

    container
      .querySelector<HTMLElement>(".skills-kovahub-row")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onKovaHubDetailOpen).toHaveBeenCalledWith("github");

    const installButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("Install"),
    );
    installButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    installButtons.at(-1)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onKovaHubInstall).toHaveBeenCalledWith("github");

    const closeButton = Array.from(container.querySelectorAll(".skills-inspector button")).find(
      (button) => button.textContent?.includes("Close"),
    );
    closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onKovaHubDetailClose).toHaveBeenCalledTimes(1);
  });
});
