import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createNpmFreshnessBypassArgs, createNpmProjectInstallEnv } from "./npm-install-env.js";

const FROZEN_NOW = new Date("2026-05-18T19:55:00.000Z");

const EXPECTED_FRESHNESS_ENV = {
  NPM_CONFIG_BEFORE: "",
  NPM_CONFIG_MIN_RELEASE_AGE: "",
  "NPM_CONFIG_MIN-RELEASE-AGE": "",
  npm_config_before: "",
  "npm_config_min-release-age": "",
  npm_config_min_release_age: "0",
};

describe("npm project install env", () => {
  it("bypasses npm release-age filters for Kova-managed installs", () => {
    const env = createNpmProjectInstallEnv(
      {
        NPM_CONFIG_BEFORE: "2026-01-01T00:00:00.000Z",
        NPM_CONFIG_MIN_RELEASE_AGE: "7",
        "npm_config_min-release-age": "7",
        npm_config_before: "2026-01-01T00:00:00.000Z",
        npm_config_min_release_age: "7",
      },
      {},
      FROZEN_NOW,
    );

    expect(env).toMatchObject(EXPECTED_FRESHNESS_ENV);
  });

  it("does not leak parent npm freshness env into explicit child envs", () => {
    const previousBefore = process.env.NPM_CONFIG_BEFORE;
    process.env.NPM_CONFIG_BEFORE = "2026-01-01T00:00:00.000Z";
    try {
      const env = createNpmProjectInstallEnv({}, {}, FROZEN_NOW);

      expect(env).toMatchObject(EXPECTED_FRESHNESS_ENV);
    } finally {
      if (previousBefore == null) {
        delete process.env.NPM_CONFIG_BEFORE;
      } else {
        process.env.NPM_CONFIG_BEFORE = previousBefore;
      }
    }
  });

  it("uses release-age args by default", () => {
    expect(createNpmFreshnessBypassArgs({}, FROZEN_NOW)).toEqual(["--min-release-age=0"]);
  });

  it("uses before args for stale npm before policies", () => {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "kova-npmrc-"));
    try {
      const npmrc = path.join(dir, "npmrc");
      fsSync.writeFileSync(npmrc, "before=2026-01-01T00:00:00.000Z\n", "utf-8");

      expect(
        createNpmFreshnessBypassArgs(
          {
            NPM_CONFIG_USERCONFIG: npmrc,
          },
          FROZEN_NOW,
        ),
      ).toEqual([`--before=${FROZEN_NOW.toISOString()}`]);
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses before args for expanded npm userconfig paths", () => {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "kova-home-npmrc-"));
    try {
      fsSync.writeFileSync(path.join(dir, ".npmrc"), "before=2026-01-01T00:00:00.000Z\n", "utf-8");

      expect(
        createNpmFreshnessBypassArgs(
          {
            HOME: dir,
            NPM_CONFIG_USERCONFIG: "~/.npmrc",
          },
          FROZEN_NOW,
        ),
      ).toEqual([`--before=${FROZEN_NOW.toISOString()}`]);
      expect(
        createNpmFreshnessBypassArgs(
          {
            HOME: dir,
            NPM_CONFIG_USERCONFIG: "${HOME}/.npmrc",
          },
          FROZEN_NOW,
        ),
      ).toEqual([`--before=${FROZEN_NOW.toISOString()}`]);
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses before args for command project npmrc before policies", () => {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "kova-project-npmrc-"));
    try {
      fsSync.writeFileSync(path.join(dir, ".npmrc"), "before=2026-01-01T00:00:00.000Z\n", "utf-8");

      expect(createNpmFreshnessBypassArgs({}, FROZEN_NOW, { npmConfigCwd: dir })).toEqual([
        `--before=${FROZEN_NOW.toISOString()}`,
      ]);

      const env = createNpmProjectInstallEnv({}, { npmConfigCwd: dir }, FROZEN_NOW);
      expect(env.npm_config_min_release_age).toBe("");
      expect(env.npm_config_before).toBe(FROZEN_NOW.toISOString());
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses before args for the current project npmrc by default", () => {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "kova-current-npmrc-"));
    try {
      fsSync.writeFileSync(path.join(dir, ".npmrc"), "before=2026-01-01T00:00:00.000Z\n", "utf-8");
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
      try {
        expect(createNpmFreshnessBypassArgs({}, FROZEN_NOW)).toEqual([
          `--before=${FROZEN_NOW.toISOString()}`,
        ]);
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses release-age args for npmrc release-age policies", () => {
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), "kova-npmrc-"));
    try {
      const npmrc = path.join(dir, "npmrc");
      fsSync.writeFileSync(npmrc, "min-release-age=7\n", "utf-8");

      expect(
        createNpmFreshnessBypassArgs(
          {
            NPM_CONFIG_USERCONFIG: npmrc,
          },
          FROZEN_NOW,
        ),
      ).toEqual(["--min-release-age=0"]);
    } finally {
      fsSync.rmSync(dir, { recursive: true, force: true });
    }
  });
});
