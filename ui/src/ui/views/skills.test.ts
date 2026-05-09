/* @vitest-environment jsdom */

import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillStatusEntry, SkillStatusReport } from "../types.ts";
import { renderSkills, type SkillsProps } from "./skills.ts";

const dialogRestores: Array<() => void> = [];

function normalizeText(node: Element | DocumentFragment): string {
  return node.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function createSkill(overrides: Partial<SkillStatusEntry> = {}): SkillStatusEntry {
  return {
    name: "Repo Skill",
    description: "Skill description",
    source: "workspace",
    filePath: "/tmp/skill",
    baseDir: "/tmp",
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
    skills: [createSkill()],
  };

  return {
    connected: true,
    loading: false,
    report,
    error: null,
    filter: "",
    statusFilter: "all",
    edits: {},
    busyKey: null,
    messages: {},
    detailKey: null,
    clawhubQuery: "",
    clawhubResults: null,
    clawhubSearchLoading: false,
    clawhubSearchError: null,
    clawhubDetail: null,
    clawhubDetailSlug: null,
    clawhubDetailLoading: false,
    clawhubDetailError: null,
    clawhubInstallSlug: null,
    clawhubInstallMessage: null,
    onFilterChange: () => undefined,
    onStatusFilterChange: () => undefined,
    onRefresh: () => undefined,
    onToggle: () => undefined,
    onEdit: () => undefined,
    onSaveKey: () => undefined,
    onInstall: () => undefined,
    onDetailOpen: () => undefined,
    onDetailClose: () => undefined,
    onClawHubQueryChange: () => undefined,
    onClawHubDetailOpen: () => undefined,
    onClawHubDetailClose: () => undefined,
    onClawHubInstall: () => undefined,
    onClawHubUninstall: () => undefined,
    ...overrides,
  };
}

describe("renderSkills", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    while (dialogRestores.length > 0) {
      dialogRestores.pop()?.();
    }
  });

  it("renders installed skills as aligned rectangular cards", () => {
    const container = document.createElement("div");
    const onClawHubUninstall = vi.fn();

    render(
      renderSkills(
        createProps({
          report: {
            workspaceDir: "/tmp/workspace",
            managedSkillsDir: "/tmp/skills",
            skills: [
              createSkill({ name: "Repo Skill", skillKey: "repo-skill", source: "workspace" }),
              createSkill({
                name: "Needs Setup",
                skillKey: "needs-setup",
                eligible: false,
                missing: { bins: ["gh"], env: [], config: [], os: [] },
              }),
              createSkill({
                name: "Marketplace Skill",
                skillKey: "marketplace-skill",
                source: "openclaw-workspace",
              }),
            ],
          },
          onClawHubUninstall,
        }),
      ),
      container,
    );

    const grid = container.querySelector(".skills-grid");
    const cards = Array.from(container.querySelectorAll(".skill-card"));
    const statusBar = container.querySelector(".skills-status-bar");

    expect(grid).toBeTruthy();
    expect(cards).toHaveLength(3);
    expect(statusBar?.querySelector('input[name="skills-filter"]')).toBeTruthy();
    expect(statusBar?.querySelector('input[name="clawhub-search"]')).toBeTruthy();
    const repoCard = cards.find((card) => normalizeText(card).includes("Repo Skill"));
    const needsSetupCard = cards.find((card) => normalizeText(card).includes("Needs Setup"));
    const marketplaceCard = cards.find((card) => normalizeText(card).includes("Marketplace Skill"));
    expect(repoCard).toBeTruthy();
    expect(needsSetupCard).toBeTruthy();
    expect(marketplaceCard).toBeTruthy();
    expect(normalizeText(repoCard!)).toContain("Ready");
    expect(normalizeText(repoCard!)).toContain("Workspace");
    expect(normalizeText(needsSetupCard!)).toContain("Needs setup");
    expect(normalizeText(needsSetupCard!)).not.toContain("1 missing");
    expect(normalizeText(marketplaceCard!)).toContain("Marketplace");
    expect(normalizeText(container)).not.toContain("shown");

    marketplaceCard?.querySelector<HTMLButtonElement>(".skill-card__actions .btn.danger")?.click();

    expect(onClawHubUninstall).toHaveBeenCalledTimes(1);
    expect(onClawHubUninstall).toHaveBeenCalledWith("marketplace-skill");
  });

  it("opens detail dialogs and routes ClawHub actions", async () => {
    const container = document.createElement("div");
    const onDetailClose = vi.fn();
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const onClawHubDetailOpen = vi.fn();
    const onClawHubInstall = vi.fn();
    const onClawHubUninstall = vi.fn();

    installDialogMethod("showModal", showModal);
    installDialogMethod("close", function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });

    render(
      renderSkills(
        createProps({
          detailKey: "repo-skill",
          onDetailClose,
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(showModal).toHaveBeenCalledTimes(1);
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(true);

    container.querySelector<HTMLButtonElement>(".md-preview-dialog__header .btn")?.click();

    expect(onDetailClose).toHaveBeenCalledTimes(1);

    render(
      renderSkills(
        createProps({
          clawhubQuery: "git",
          clawhubResults: [
            {
              score: 0.95,
              slug: "github",
              displayName: "GitHub",
              summary: "GitHub integration for OpenClaw",
              version: "1.2.3",
            },
          ],
          onClawHubDetailOpen,
          onClawHubInstall,
        }),
      ),
      container,
    );
    await Promise.resolve();

    let text = normalizeText(container);
    expect(text).toContain("GitHub");
    expect(text).toContain("GitHub integration for OpenClaw");
    expect(text).toContain("v1.2.3");

    container.querySelector<HTMLElement>(".list-item")?.click();
    container
      .querySelector<HTMLButtonElement>(".list-item .btn.btn--sm")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClawHubDetailOpen).toHaveBeenCalledTimes(1);
    expect(onClawHubDetailOpen).toHaveBeenCalledWith("github");
    expect(onClawHubInstall).toHaveBeenCalledTimes(1);
    expect(onClawHubInstall).toHaveBeenCalledWith("github");

    onClawHubInstall.mockClear();
    onClawHubDetailOpen.mockClear();
    showModal.mockClear();

    render(
      renderSkills(
        createProps({
          report: {
            workspaceDir: "/tmp/workspace",
            managedSkillsDir: "/tmp/skills",
            skills: [createSkill({ skillKey: "github", source: "openclaw-workspace" })],
          },
          clawhubQuery: "git",
          clawhubResults: [
            {
              score: 0.95,
              slug: "github",
              displayName: "GitHub",
              summary: "GitHub integration for OpenClaw",
              version: "1.2.3",
            },
          ],
          onClawHubDetailOpen,
          onClawHubInstall,
          onClawHubUninstall,
        }),
      ),
      container,
    );
    await Promise.resolve();

    container
      .querySelector<HTMLButtonElement>(".list-item .btn.btn--sm")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClawHubInstall).not.toHaveBeenCalled();
    expect(onClawHubUninstall).toHaveBeenCalledTimes(1);
    expect(onClawHubUninstall).toHaveBeenCalledWith("github");

    onClawHubUninstall.mockClear();
    showModal.mockClear();

    render(
      renderSkills(
        createProps({
          clawhubSearchError: "rate limited",
          clawhubInstallMessage: { kind: "success", text: "Installed github" },
          clawhubDetailSlug: "github",
          clawhubDetail: {
            skill: {
              slug: "github",
              displayName: "GitHub",
              summary: "GitHub integration for OpenClaw",
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
              displayName: "OpenClaw",
              handle: "openclaw",
            },
          },
          onClawHubInstall,
          onClawHubUninstall,
        }),
      ),
      container,
    );
    await Promise.resolve();

    expect(showModal).toHaveBeenCalledTimes(1);
    text = normalizeText(container);
    expect(text).toContain("rate limited");
    expect(text).toContain("Installed github");
    expect(text).toContain("By OpenClaw (@openclaw)");
    expect(text).toContain("Latest: v1.2.3");
    expect(text).toContain("Platforms: macos, linux");
    expect(text).toContain("Added search support");

    container
      .querySelector<HTMLButtonElement>(".md-preview-dialog__body .btn.primary")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClawHubInstall).toHaveBeenCalledTimes(1);
    expect(onClawHubInstall).toHaveBeenCalledWith("github");
  });
});

function installDialogMethod(
  name: "showModal" | "close",
  value: (this: HTMLDialogElement) => void,
) {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & Record<string, unknown>;
  const original = Object.getOwnPropertyDescriptor(proto, name);
  Object.defineProperty(proto, name, {
    configurable: true,
    writable: true,
    value,
  });
  dialogRestores.push(() => {
    if (original) {
      Object.defineProperty(proto, name, original);
      return;
    }
    delete proto[name];
  });
}
