import { describe, expect, it } from "vitest";
import {
  ensureKovaExecMarkerOnProcess,
  markKovaExecEnv,
  KOVA_CLI_ENV_VALUE,
  KOVA_CLI_ENV_VAR,
} from "./kova-exec-env.js";

describe("markKovaExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", KOVA_CLI: "0" };
    const marked = markKovaExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      KOVA_CLI: KOVA_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.KOVA_CLI).toBe("0");
  });
});

describe("ensureKovaExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [KOVA_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureKovaExecMarkerOnProcess(env)).toBe(env);
    expect(env[KOVA_CLI_ENV_VAR]).toBe(KOVA_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[KOVA_CLI_ENV_VAR];
    delete process.env[KOVA_CLI_ENV_VAR];

    try {
      expect(ensureKovaExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[KOVA_CLI_ENV_VAR]).toBe(KOVA_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[KOVA_CLI_ENV_VAR];
      } else {
        process.env[KOVA_CLI_ENV_VAR] = previous;
      }
    }
  });
});
