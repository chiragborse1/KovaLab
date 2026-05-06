import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerSettingsCommand } from "./register.settings.js";

const mocks = vi.hoisted(() => ({
  settingsCommand: vi.fn(),
  runtime: {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  },
}));

vi.mock("../../commands/settings.js", () => ({
  settingsCommand: mocks.settingsCommand,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: mocks.runtime,
}));

describe("registerSettingsCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsCommand.mockResolvedValue(undefined);
  });

  async function runCli(args: string[]) {
    const program = new Command();
    registerSettingsCommand(program);
    await program.parseAsync(args, { from: "user" });
  }

  it("registers kova settings", async () => {
    await runCli(["settings"]);

    expect(mocks.settingsCommand).toHaveBeenCalledWith(mocks.runtime);
  });

  it("reports command failures through runtime", async () => {
    mocks.settingsCommand.mockRejectedValueOnce(new Error("settings failed"));

    await runCli(["settings"]);

    expect(mocks.runtime.error).toHaveBeenCalledWith("Error: settings failed");
    expect(mocks.runtime.exit).toHaveBeenCalledWith(1);
  });
});
