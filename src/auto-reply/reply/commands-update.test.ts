import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../../config/types.kova.js";
import type { UpdateRunResult } from "../../infra/update-runner.js";
import { baseCommandTestConfig, buildCommandTestParams } from "./commands.test-harness.js";

const mocks = vi.hoisted(() => ({
  getUpdateCheckResult: vi.fn(async () => ({})),
  formatUpdateOneLiner: vi.fn(() => "Update: git dev · up to date"),
  formatUpdateAvailableHint: vi.fn(() => null as string | null),
  resolveKovaPackageRoot: vi.fn(async () => "/repo/kova"),
  runGatewayUpdate: vi.fn(
    async (): Promise<UpdateRunResult> => ({
      status: "ok",
      mode: "git",
      root: "/repo/kova",
      before: { sha: "1111111111111111", version: "1.0.0" },
      after: { sha: "2222222222222222", version: "1.0.1" },
      steps: [],
      durationMs: 10,
    }),
  ),
  scheduleGatewaySigusr1Restart: vi.fn(() => ({
    ok: true,
    pid: 1,
    signal: "SIGUSR1" as const,
    delayMs: 1500,
    mode: "emit" as const,
    coalesced: false,
    cooldownMsApplied: 0,
  })),
  isRestartEnabled: vi.fn(() => true),
}));

vi.mock("../../commands/status.update.js", () => ({
  getUpdateCheckResult: mocks.getUpdateCheckResult,
  formatUpdateOneLiner: mocks.formatUpdateOneLiner,
  formatUpdateAvailableHint: mocks.formatUpdateAvailableHint,
}));

vi.mock("../../infra/kova-root.js", () => ({
  resolveKovaPackageRoot: mocks.resolveKovaPackageRoot,
}));

vi.mock("../../infra/update-runner.js", () => ({
  runGatewayUpdate: mocks.runGatewayUpdate,
}));

vi.mock("../../infra/restart.js", () => ({
  scheduleGatewaySigusr1Restart: mocks.scheduleGatewaySigusr1Restart,
}));

vi.mock("../../config/commands.flags.js", () => ({
  isRestartEnabled: mocks.isRestartEnabled,
}));

const { handleUpdateCommand } = await import("./commands-update.js");

function updateParams(body: string, cfg?: KovaConfig) {
  const params = buildCommandTestParams(body, {
    ...baseCommandTestConfig,
    commands: {
      text: true,
      restart: true,
    },
    update: { channel: "beta" },
    ...cfg,
  } as KovaConfig);
  params.command.commandBodyNormalized = body;
  params.command.rawBodyNormalized = body;
  params.command.senderIsOwner = true;
  params.command.isAuthorizedSender = true;
  return params;
}

describe("handleUpdateCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRestartEnabled.mockReturnValue(true);
    mocks.formatUpdateAvailableHint.mockReturnValue(null);
  });

  it("checks update status without running the updater", async () => {
    const result = await handleUpdateCommand(updateParams("/update status"), true);

    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply?.text).toContain("Kova update status");
    expect(result?.reply?.text).toContain("git dev · up to date");
    expect(mocks.runGatewayUpdate).not.toHaveBeenCalled();
  });

  it("runs the updater and schedules restart when the gateway can self-restart", async () => {
    const listener = vi.fn();
    process.on("SIGUSR1", listener);
    try {
      const result = await handleUpdateCommand(updateParams("/update"), true);

      expect(result?.shouldContinue).toBe(false);
      expect(result?.reply?.text).toContain("Kova update ok");
      expect(result?.reply?.text).toContain("- Restart: scheduled");
      expect(mocks.runGatewayUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: "/repo/kova",
          channel: "beta",
        }),
      );
      expect(mocks.scheduleGatewaySigusr1Restart).toHaveBeenCalledWith(
        expect.objectContaining({
          delayMs: 1500,
          reason: "/update",
        }),
      );
    } finally {
      process.off("SIGUSR1", listener);
    }
  });

  it("does not run for non-owner senders", async () => {
    const params = updateParams("/update");
    params.command.senderIsOwner = false;

    const result = await handleUpdateCommand(params, true);

    expect(result?.shouldContinue).toBe(false);
    expect(mocks.runGatewayUpdate).not.toHaveBeenCalled();
  });
});
