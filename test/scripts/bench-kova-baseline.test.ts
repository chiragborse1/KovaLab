import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { testing } from "../../scripts/bench-kova-baseline.ts";

describe("baseline benchmark script", () => {
  it("prints help without running benchmark components", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/bench-kova-baseline.ts", "--help"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_NO_WARNINGS: "1",
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Kova baseline benchmark");
    expect(result.stdout).toContain("--profile <smoke|tui|cli|gateway|full>");
    expect(result.stdout).toContain("--current-config");
    expect(result.stdout).not.toContain("baseline written");
    expect(result.stderr).toBe("");
  });

  it("resolves benchmark profiles to concrete components", () => {
    expect(testing.resolveComponents("smoke")).toEqual(["tui", "cli"]);
    expect(testing.resolveComponents("full")).toEqual(["tui", "cli", "gateway"]);
    expect(testing.resolveComponents("gateway")).toEqual(["gateway"]);
  });

  it("parses options with strict integer validation", () => {
    expect(
      testing.parseOptions([
        "--profile",
        "tui",
        "--runs",
        "7",
        "--warmup",
        "0",
        "--current-config",
        "--tui-command",
        "/status",
      ]),
    ).toMatchObject({
      profile: "tui",
      components: ["tui"],
      runs: 7,
      warmup: 0,
      currentConfig: true,
      tuiCommand: "/status",
    });
    expect(() => testing.parsePositiveInt("2abc", 1, "--runs")).toThrow(
      /--runs must be an integer/u,
    );
  });
});
