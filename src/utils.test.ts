import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withTempDir } from "./test-helpers/temp-dir.js";
import {
  ensureDir,
  resolveConfigDir,
  resolveHomeDir,
  resolveUserPath,
  shortenHomeInString,
  shortenHomePath,
  sleep,
} from "./utils.js";

describe("ensureDir", () => {
  it("creates nested directory", async () => {
    await withTempDir({ prefix: "kova-test-" }, async (tmp) => {
      const target = path.join(tmp, "nested", "dir");
      await ensureDir(target);
      expect(fs.existsSync(target)).toBe(true);
    });
  });
});

describe("sleep", () => {
  it("resolves after delay using fake timers", async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe("resolveConfigDir", () => {
  it("prefers ~/.kova when legacy dir is missing", async () => {
    await withTempDir({ prefix: "kova-config-dir-" }, async (root) => {
      const newDir = path.join(root, ".kova");
      await fs.promises.mkdir(newDir, { recursive: true });
      const resolved = resolveConfigDir({} as NodeJS.ProcessEnv, () => root);
      expect(resolved).toBe(newDir);
    });
  });

  it("expands KOVA_STATE_DIR using the provided env", () => {
    const env = {
      HOME: "/tmp/kova-home",
      KOVA_STATE_DIR: "~/state",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/kova-home", "state"));
  });

  it("falls back to the config file directory when only KOVA_CONFIG_PATH is set", () => {
    const env = {
      HOME: "/tmp/kova-home",
      KOVA_CONFIG_PATH: "~/profiles/dev/kova.json",
    } as NodeJS.ProcessEnv;

    expect(resolveConfigDir(env)).toBe(path.resolve("/tmp/kova-home", "profiles", "dev"));
  });
});

describe("resolveHomeDir", () => {
  it("prefers KOVA_HOME over HOME", () => {
    vi.stubEnv("KOVA_HOME", "/srv/kova-home");
    vi.stubEnv("HOME", "/home/other");

    expect(resolveHomeDir()).toBe(path.resolve("/srv/kova-home"));

    vi.unstubAllEnvs();
  });
});

describe("shortenHomePath", () => {
  it("uses $KOVA_HOME prefix when KOVA_HOME is set", () => {
    vi.stubEnv("KOVA_HOME", "/srv/kova-home");
    vi.stubEnv("HOME", "/home/other");

    expect(shortenHomePath(`${path.resolve("/srv/kova-home")}/.chiragborse1/KovaLab.json`)).toBe(
      "$KOVA_HOME/.chiragborse1/KovaLab.json",
    );

    vi.unstubAllEnvs();
  });
});

describe("shortenHomeInString", () => {
  it("uses $KOVA_HOME replacement when KOVA_HOME is set", () => {
    vi.stubEnv("KOVA_HOME", "/srv/kova-home");
    vi.stubEnv("HOME", "/home/other");

    expect(
      shortenHomeInString(`config: ${path.resolve("/srv/kova-home")}/.chiragborse1/KovaLab.json`),
    ).toBe("config: $KOVA_HOME/.chiragborse1/KovaLab.json");

    vi.unstubAllEnvs();
  });
});

describe("resolveUserPath", () => {
  it("expands ~ to home dir", () => {
    expect(resolveUserPath("~", {}, () => "/Users/thoffman")).toBe(path.resolve("/Users/thoffman"));
  });

  it("expands ~/ to home dir", () => {
    expect(resolveUserPath("~/kova", {}, () => "/Users/thoffman")).toBe(
      path.resolve("/Users/thoffman", "kova"),
    );
  });

  it("resolves relative paths", () => {
    expect(resolveUserPath("tmp/dir")).toBe(path.resolve("tmp/dir"));
  });

  it("prefers KOVA_HOME for tilde expansion", () => {
    vi.stubEnv("KOVA_HOME", "/srv/kova-home");
    vi.stubEnv("HOME", "/home/other");

    expect(resolveUserPath("~/kova")).toBe(path.resolve("/srv/kova-home", "kova"));

    vi.unstubAllEnvs();
  });

  it("uses the provided env for tilde expansion", () => {
    const env = {
      HOME: "/tmp/kova-home",
      KOVA_HOME: "/srv/kova-home",
    } as NodeJS.ProcessEnv;

    expect(resolveUserPath("~/kova", env)).toBe(path.resolve("/srv/kova-home", "kova"));
  });

  it("keeps blank paths blank", () => {
    expect(resolveUserPath("")).toBe("");
    expect(resolveUserPath("   ")).toBe("");
  });

  it("returns empty string for undefined/null input", () => {
    expect(resolveUserPath(undefined as unknown as string)).toBe("");
    expect(resolveUserPath(null as unknown as string)).toBe("");
  });
});
