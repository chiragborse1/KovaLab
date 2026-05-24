import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPersonaCommand } from "./register.persona.js";

const mocks = vi.hoisted(() => ({
  personaEditCommand: vi.fn(),
  personaInitCommand: vi.fn(),
  personaPathCommand: vi.fn(),
  personaShowCommand: vi.fn(),
  personaStatusCommand: vi.fn(),
  runtime: {
    log: vi.fn(),
    error: vi.fn(),
    exit: vi.fn(),
  },
}));

vi.mock("../../commands/persona.js", () => ({
  personaEditCommand: mocks.personaEditCommand,
  personaInitCommand: mocks.personaInitCommand,
  personaPathCommand: mocks.personaPathCommand,
  personaShowCommand: mocks.personaShowCommand,
  personaStatusCommand: mocks.personaStatusCommand,
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: mocks.runtime,
}));

describe("registerPersonaCommand", () => {
  async function runCli(args: string[]) {
    const program = new Command();
    registerPersonaCommand(program);
    await program.parseAsync(args, { from: "user" });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personaEditCommand.mockResolvedValue(undefined);
    mocks.personaInitCommand.mockResolvedValue(undefined);
    mocks.personaPathCommand.mockResolvedValue(undefined);
    mocks.personaShowCommand.mockResolvedValue(undefined);
    mocks.personaStatusCommand.mockResolvedValue(undefined);
  });

  it("runs status when the root persona command is invoked", async () => {
    await runCli(["persona"]);

    expect(mocks.personaStatusCommand).toHaveBeenCalledWith({}, mocks.runtime);
  });

  it("forwards show options", async () => {
    await runCli(["persona", "show", "--agent", "main", "--lines", "20", "--all", "--json"]);

    expect(mocks.personaShowCommand).toHaveBeenCalledWith(
      {
        agent: "main",
        workspace: undefined,
        json: true,
        lines: 20,
        all: true,
      },
      mocks.runtime,
    );
  });

  it("forwards init and edit options", async () => {
    await runCli(["persona", "init", "--workspace", "/tmp/ws", "--force"]);
    await runCli(["persona", "edit", "--editor", "code --wait", "--print-path"]);

    expect(mocks.personaInitCommand).toHaveBeenCalledWith(
      {
        agent: undefined,
        workspace: "/tmp/ws",
        json: false,
        force: true,
      },
      mocks.runtime,
    );
    expect(mocks.personaEditCommand).toHaveBeenCalledWith(
      {
        agent: undefined,
        workspace: undefined,
        json: false,
        editor: "code --wait",
        printPath: true,
      },
      mocks.runtime,
    );
  });

  it("forwards path options", async () => {
    await runCli(["persona", "path", "--agent", "ops", "--json"]);

    expect(mocks.personaPathCommand).toHaveBeenCalledWith(
      {
        agent: "ops",
        workspace: undefined,
        json: true,
      },
      mocks.runtime,
    );
  });
});
