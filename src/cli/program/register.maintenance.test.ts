import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerMaintenanceCommands } from "./register.maintenance.js";

const mocks = vi.hoisted(() => ({
  doctorCommand: vi.fn(),
  controlUiCommand: vi.fn(),
  resetCommand: vi.fn(),
  uninstallCommand: vi.fn(),
  runtime: {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  },
}));

const { doctorCommand, controlUiCommand, resetCommand, uninstallCommand, runtime } = mocks;

vi.mock("../../commands/doctor.js", () => ({
  doctorCommand: mocks.doctorCommand,
}));

vi.mock("../../commands/control-ui.js", () => ({
  controlUiCommand: mocks.controlUiCommand,
}));

vi.mock("../../commands/reset.js", () => ({
  resetCommand: mocks.resetCommand,
}));

vi.mock("../../commands/uninstall.js", () => ({
  uninstallCommand: mocks.uninstallCommand,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: mocks.runtime,
}));

describe("registerMaintenanceCommands doctor action", () => {
  async function runMaintenanceCli(args: string[]) {
    const program = new Command();
    registerMaintenanceCommands(program);
    await program.parseAsync(args, { from: "user" });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exits with code 0 after successful doctor run", async () => {
    doctorCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["doctor", "--non-interactive", "--yes"]);

    expect(doctorCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        nonInteractive: true,
        yes: true,
      }),
    );
    expect(runtime.exit).toHaveBeenCalledWith(0);
  });

  it("exits with code 1 when doctor fails", async () => {
    doctorCommand.mockRejectedValue(new Error("doctor failed"));

    await runMaintenanceCli(["doctor"]);

    expect(runtime.error).toHaveBeenCalledWith("Error: doctor failed");
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(runtime.exit).not.toHaveBeenCalledWith(0);
  });

  it("maps --fix to repair=true", async () => {
    doctorCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["doctor", "--fix"]);

    expect(doctorCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        repair: true,
      }),
    );
  });

  it("passes noOpen to control-ui command", async () => {
    controlUiCommand.mockResolvedValue(undefined);

    await runMaintenanceCli(["control-ui", "--no-open"]);

    expect(controlUiCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        noOpen: true,
      }),
    );
  });

  it("does not expose dashboard in help output", () => {
    const program = new Command();
    registerMaintenanceCommands(program);

    expect(program.helpInformation()).toContain("control-ui");
    expect(program.helpInformation()).not.toContain("dashboard");
  });

  it("passes reset options to reset command", async () => {
    resetCommand.mockResolvedValue(undefined);

    await runMaintenanceCli([
      "reset",
      "--scope",
      "full",
      "--yes",
      "--non-interactive",
      "--dry-run",
    ]);

    expect(resetCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        scope: "full",
        yes: true,
        nonInteractive: true,
        dryRun: true,
      }),
    );
  });

  it("passes uninstall options to uninstall command", async () => {
    uninstallCommand.mockResolvedValue(undefined);

    await runMaintenanceCli([
      "uninstall",
      "--service",
      "--state",
      "--workspace",
      "--app",
      "--all",
      "--yes",
      "--non-interactive",
      "--dry-run",
    ]);

    expect(uninstallCommand).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({
        service: true,
        state: true,
        workspace: true,
        app: true,
        all: true,
        yes: true,
        nonInteractive: true,
        dryRun: true,
      }),
    );
  });

  it("exits with code 1 when control-ui fails", async () => {
    controlUiCommand.mockRejectedValue(new Error("control ui failed"));

    await runMaintenanceCli(["control-ui"]);

    expect(runtime.error).toHaveBeenCalledWith("Error: control ui failed");
    expect(runtime.exit).toHaveBeenCalledWith(1);
  });
});
