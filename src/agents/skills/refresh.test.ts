import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillsChangeEvent } from "./refresh.js";

type WatchEvent = "add" | "change" | "unlink" | "unlinkDir" | "error";
type WatchCallback = (watchPath: string) => void;

function createMockWatcher() {
  const handlers = new Map<WatchEvent, WatchCallback[]>();
  const watcher = {
    on: vi.fn((event: WatchEvent, callback: WatchCallback) => {
      handlers.set(event, [...(handlers.get(event) ?? []), callback]);
      return watcher;
    }),
    close: vi.fn(async () => undefined),
    emit: (event: WatchEvent, watchPath: string) => {
      for (const callback of handlers.get(event) ?? []) {
        callback(watchPath);
      }
    },
  };
  return watcher;
}

const createdWatchers: Array<ReturnType<typeof createMockWatcher>> = [];
const watchMock = vi.fn(() => {
  const watcher = createMockWatcher();
  createdWatchers.push(watcher);
  return watcher;
});

let refreshModule: typeof import("./refresh.js");

vi.mock("chokidar", () => ({
  default: { watch: watchMock },
}));

vi.mock("./plugin-skills.js", () => ({
  resolvePluginSkillDirs: vi.fn(() => []),
}));

describe("ensureSkillsWatcher", () => {
  beforeAll(async () => {
    refreshModule = await import("./refresh.js");
  });

  beforeEach(() => {
    watchMock.mockClear();
    createdWatchers.length = 0;
  });

  afterEach(async () => {
    vi.useRealTimers();
    await refreshModule.resetSkillsRefreshForTest();
  });

  it("watches skill roots with bounded per-path watchers and filters non-skill churn", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-watch-root-"));
    try {
      refreshModule.ensureSkillsWatcher({ workspaceDir });

      const calls = watchMock.mock.calls as unknown as Array<
        [string, { depth?: number; followSymlinks?: boolean; ignored?: unknown }]
      >;
      expect(calls.length).toBeGreaterThan(0);
      const targets = calls.map((call) => call[0]);
      const opts = calls[0]?.[1] ?? {};
      const posix = (p: string) => p.replaceAll("\\", "/");
      const workspaceSkillsRoot = posix(path.join(workspaceDir, "skills"));

      expect(opts.ignored).toBe(refreshModule.shouldIgnoreSkillsWatchPath);
      expect(opts.followSymlinks).toBe(false);
      expect(targets).toContain(workspaceSkillsRoot);
      expect(targets).toContain(posix(path.join(workspaceDir, ".agents", "skills")));
      expect(targets).toContain(posix(path.join(os.homedir(), ".agents", "skills")));
      expect(calls.find(([p]) => posix(p) === workspaceSkillsRoot)?.[1].depth).toBe(7);
      expect(targets.every((target) => !target.includes("*"))).toBe(true);

      const ignored = refreshModule.shouldIgnoreSkillsWatchPath;
      expect(ignored("/tmp/workspace/skills/node_modules/pkg/index.js")).toBe(true);
      expect(ignored("/tmp/workspace/skills/dist/index.js")).toBe(true);
      expect(ignored("/tmp/workspace/skills/.git/config")).toBe(true);
      expect(ignored("/tmp/workspace/skills/scripts/.venv/bin/python")).toBe(true);
      expect(ignored("/tmp/workspace/skills/venv/lib/python3.10/site.py")).toBe(true);
      expect(ignored("/tmp/workspace/skills/__pycache__/module.pyc")).toBe(true);
      expect(ignored("/tmp/workspace/skills/.mypy_cache/3.10/foo.json")).toBe(true);
      expect(ignored("/tmp/workspace/skills/.pytest_cache/v/cache")).toBe(true);
      expect(ignored("/tmp/workspace/skills/build/output.js")).toBe(true);
      expect(ignored("/tmp/workspace/skills/.cache/data.json")).toBe(true);
      expect(ignored("/tmp/.hidden/skills/index.md")).toBe(false);
      expect(ignored("/tmp/workspace/skills/my-skill", { isDirectory: () => true })).toBe(false);
      expect(ignored("/tmp/workspace/skills/my-skill", { isSymbolicLink: () => true })).toBe(false);
      expect(ignored("/tmp/workspace/skills/my-skill/README.md", {})).toBe(true);
      expect(ignored("/tmp/workspace/skills/my-skill/SKILL.md", {})).toBe(false);
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("watches nested skills roots for repo-style extra dirs", async () => {
    const repoDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-skills-watch-"));
    try {
      await fs.mkdir(path.join(repoDir, "skills", "group", "demo"), { recursive: true });
      await fs.writeFile(
        path.join(repoDir, "skills", "group", "demo", "SKILL.md"),
        "---\nname: demo\ndescription: Demo\n---\n",
      );

      refreshModule.ensureSkillsWatcher({
        workspaceDir: "/tmp/workspace",
        config: { skills: { load: { extraDirs: [repoDir] } } },
      });

      const calls = watchMock.mock.calls as unknown as Array<[string, { depth?: number }]>;
      const targets = calls.map(([p]) => p.replaceAll("\\", "/"));
      const repoRoot = repoDir.replaceAll("\\", "/");
      const nestedRoot = path.join(repoDir, "skills").replaceAll("\\", "/");
      expect(targets).toContain(nestedRoot);
      expect(targets).toContain(repoRoot);
      expect(calls.find(([p]) => p.replaceAll("\\", "/") === repoRoot)?.[1].depth).toBe(2);
      expect(calls.find(([p]) => p.replaceAll("\\", "/") === nestedRoot)?.[1].depth).toBe(6);
    } finally {
      await fs.rm(repoDir, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform !== "win32")(
    "watches allowed symlink skill targets without following every root symlink",
    async () => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-watch-symlink-"));
      const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "kova-watch-symlink-target-"));
      try {
        const workspaceSkillsDir = path.join(workspaceDir, "skills");
        const targetSkillDir = path.join(targetRoot, "linked-skill");
        const groupedLinkDir = path.join(workspaceSkillsDir, "group");
        await fs.mkdir(groupedLinkDir, { recursive: true });
        await fs.mkdir(targetSkillDir, { recursive: true });
        await fs.writeFile(
          path.join(targetSkillDir, "SKILL.md"),
          "---\nname: linked-skill\ndescription: Linked\n---\n",
        );
        await fs.symlink(targetSkillDir, path.join(groupedLinkDir, "linked-skill"), "dir");

        refreshModule.ensureSkillsWatcher({
          workspaceDir,
          config: { skills: { load: { allowSymlinkTargets: [targetRoot] } } },
        });

        const calls = watchMock.mock.calls as unknown as Array<
          [string, { followSymlinks?: boolean }]
        >;
        const target = (await fs.realpath(targetSkillDir)).replaceAll("\\", "/");
        expect(calls.find(([p]) => p.replaceAll("\\", "/") === target)?.[1].followSymlinks).toBe(
          false,
        );
      } finally {
        await fs.rm(workspaceDir, { recursive: true, force: true });
        await fs.rm(targetRoot, { recursive: true, force: true });
      }
    },
  );

  it.each(["add", "change", "unlink", "unlinkDir"] as const)(
    "refreshes skills snapshots on %s",
    async (event) => {
      vi.useFakeTimers();
      const seen: SkillsChangeEvent[] = [];
      refreshModule.registerSkillsChangeListener((change) => {
        seen.push(change);
      });
      refreshModule.ensureSkillsWatcher({
        workspaceDir: "/tmp/workspace",
        config: { skills: { load: { watchDebounceMs: 10 } } },
      });

      createdWatchers[0]?.emit(event, "/tmp/workspace/skills/demo/SKILL.md");
      await vi.advanceTimersByTimeAsync(10);

      expect(seen).toEqual([
        {
          workspaceDir: "/tmp/workspace",
          reason: "watch",
          changedPath: "/tmp/workspace/skills/demo/SKILL.md",
        },
      ]);
    },
  );

  it("refreshes skills snapshots when watched skill roots change", () => {
    const seen: SkillsChangeEvent[] = [];
    refreshModule.registerSkillsChangeListener((change) => {
      seen.push(change);
    });
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/workspace",
      config: { skills: { load: { extraDirs: ["/tmp/shared-a"] } } },
    });

    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/workspace",
      config: { skills: { load: { extraDirs: ["/tmp/shared-b"] } } },
    });

    const callPaths = (watchMock.mock.calls as unknown as Array<[string]>).map((call) => call[0]);
    const sharedAIndex = callPaths.findIndex((target) => target.includes("/tmp/shared-a"));
    expect(sharedAIndex).toBeGreaterThanOrEqual(0);
    expect(createdWatchers[sharedAIndex]?.close).toHaveBeenCalledTimes(1);
    expect(callPaths.some((target) => target.includes("/tmp/shared-b"))).toBe(true);
    expect(seen).toEqual([
      {
        workspaceDir: "/tmp/workspace",
        reason: "watch-targets",
        changedPath: expect.stringContaining("/tmp/shared-b"),
      },
    ]);
  });

  it("reuses one watcher when multiple workspaces watch the same shared skill root", () => {
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-a",
      config: { skills: { load: { extraDirs: ["/tmp/shared"] } } },
    });
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-b",
      config: { skills: { load: { extraDirs: ["/tmp/shared"] } } },
    });

    const callPaths = (watchMock.mock.calls as unknown as Array<[string]>).map((call) => call[0]);
    expect(callPaths.filter((target) => target === "/tmp/shared")).toHaveLength(1);
    expect(callPaths.filter((target) => target === "/tmp/shared/skills")).toHaveLength(1);
  });

  it("fans out a shared-directory change to every subscribed workspace", async () => {
    vi.useFakeTimers();
    const seen: SkillsChangeEvent[] = [];
    refreshModule.registerSkillsChangeListener((change) => {
      seen.push(change);
    });
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-a",
      config: { skills: { load: { extraDirs: ["/tmp/shared"], watchDebounceMs: 10 } } },
    });
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-b",
      config: { skills: { load: { extraDirs: ["/tmp/shared"], watchDebounceMs: 10 } } },
    });

    const callPaths = (watchMock.mock.calls as unknown as Array<[string]>).map((call) => call[0]);
    const sharedIndex = callPaths.findIndex((target) => target.includes("/tmp/shared"));
    expect(sharedIndex).toBeGreaterThanOrEqual(0);

    createdWatchers[sharedIndex]?.emit("change", "/tmp/shared/demo/SKILL.md");
    await vi.advanceTimersByTimeAsync(10);

    expect(seen).toContainEqual({
      workspaceDir: "/tmp/ws-a",
      reason: "watch",
      changedPath: "/tmp/shared/demo/SKILL.md",
    });
    expect(seen).toContainEqual({
      workspaceDir: "/tmp/ws-b",
      reason: "watch",
      changedPath: "/tmp/shared/demo/SKILL.md",
    });
  });

  it("stops fanning a shared-directory change to a workspace after it unsubscribes", async () => {
    vi.useFakeTimers();
    const seen: SkillsChangeEvent[] = [];
    refreshModule.registerSkillsChangeListener((change) => {
      seen.push(change);
    });
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-a",
      config: { skills: { load: { extraDirs: ["/tmp/shared"], watchDebounceMs: 10 } } },
    });
    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-b",
      config: { skills: { load: { extraDirs: ["/tmp/shared"], watchDebounceMs: 10 } } },
    });

    refreshModule.ensureSkillsWatcher({
      workspaceDir: "/tmp/ws-a",
      config: { skills: { load: { extraDirs: ["/tmp/shared"], watch: false } } },
    });

    const callPaths = (watchMock.mock.calls as unknown as Array<[string]>).map((call) => call[0]);
    const sharedIndex = callPaths.findIndex((target) => target.includes("/tmp/shared"));
    expect(sharedIndex).toBeGreaterThanOrEqual(0);

    createdWatchers[sharedIndex]?.emit("change", "/tmp/shared/demo/SKILL.md");
    await vi.advanceTimersByTimeAsync(10);

    expect(seen).toContainEqual({
      workspaceDir: "/tmp/ws-b",
      reason: "watch",
      changedPath: "/tmp/shared/demo/SKILL.md",
    });
    expect(seen.some((change) => change.workspaceDir === "/tmp/ws-a")).toBe(false);
  });
});
