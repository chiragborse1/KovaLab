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
    expect(result.stdout).toContain("--tui-backend <local-process|embedded>");
    expect(result.stdout).toContain("--current-config");
    expect(result.stdout).toContain("--markdown-output <path>");
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
        "--tui-backend",
        "embedded",
        "--output",
        ".artifacts/custom/result.json",
      ]),
    ).toMatchObject({
      profile: "tui",
      components: ["tui"],
      runs: 7,
      warmup: 0,
      currentConfig: true,
      tuiCommand: "/status",
      tuiBackend: "embedded",
      output: ".artifacts/custom/result.json",
      markdownOutput: ".artifacts/custom/result.md",
    });
    expect(() => testing.parsePositiveInt("2abc", 1, "--runs")).toThrow(
      /--runs must be an integer/u,
    );
  });

  it("renders a compact markdown report for benchmark artifacts", () => {
    const report = testing.renderBaselineMarkdown({
      generatedAt: "2026-05-22T00:00:00.000Z",
      profile: "tui",
      components: ["tui"],
      outputPath: ".artifacts/kova-baseline/latest.json",
      tui: {
        command: "/status",
        backendMode: "embedded",
        currentConfig: false,
        runs: 1,
        warmup: 0,
        startupMs: 123.4,
        summary: {
          finalMs: { avg: 100, p50: 100, p95: 100, min: 100, max: 100 },
          firstEventMs: { avg: 10, p50: 10, p95: 10, min: 10, max: 10 },
        },
        samples: [
          {
            runId: "abcdef123456",
            status: "final",
            firstEventMs: 10,
            finalMs: 100,
            trace: {},
            slowestDetail: "provider/model runtime",
          },
        ],
      },
    });

    expect(report).toContain("# Kova Baseline Performance Report");
    expect(report).toContain("- Backend: embedded");
    expect(report).toContain("Final latency");
    expect(report).toContain("| abcdef12 | final | 10ms | 100ms | provider/model runtime |");
  });
});
