import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses ~/.kova/workspace by default", () => {
    vi.stubEnv("KOVA_HOME", undefined);
    vi.stubEnv("OPENCLAW_HOME", undefined);
    vi.stubEnv("HOME", path.join(path.sep, "home", "chirag"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.sep, "home", "chirag", ".kova", "workspace"),
    );
  });

  it("uses KOVA_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "kova-home");
    vi.stubEnv("KOVA_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".kova", "workspace"),
    );
  });

  it("keeps profile workspaces under ~/.kova", () => {
    vi.stubEnv("KOVA_HOME", undefined);
    vi.stubEnv("OPENCLAW_HOME", undefined);
    vi.stubEnv("HOME", path.join(path.sep, "home", "chirag"));
    vi.stubEnv("OPENCLAW_PROFILE", "work");

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.sep, "home", "chirag", ".kova", "workspace-work"),
    );
  });
});
