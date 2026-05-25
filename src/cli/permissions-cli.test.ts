import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPermissionsCli } from "./permissions-cli.js";

const mocks = vi.hoisted(() => ({
  readConfigFileSnapshot: vi.fn(),
  readExecApprovalsSnapshot: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
  exit: vi.fn(),
  writeJson: vi.fn(),
}));

vi.mock("../config/config.js", () => ({
  readConfigFileSnapshot: mocks.readConfigFileSnapshot,
}));

vi.mock("../infra/exec-approvals.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/exec-approvals.js")>(
    "../infra/exec-approvals.js",
  );
  return {
    ...actual,
    readExecApprovalsSnapshot: mocks.readExecApprovalsSnapshot,
  };
});

vi.mock("../runtime.js", () => ({
  defaultRuntime: {
    log: mocks.log,
    error: mocks.error,
    exit: mocks.exit,
    writeJson: mocks.writeJson,
  },
}));

function createConfig() {
  return {
    tools: {
      profile: "coding",
      deny: ["exec"],
      exec: {
        security: "allowlist",
        ask: "on-miss",
      },
      fs: {
        workspaceOnly: true,
      },
    },
    plugins: {
      allow: ["telegram"],
      entries: {
        telegram: { enabled: true },
      },
    },
    agents: {
      defaults: {
        sandbox: {
          mode: "non-main",
        },
      },
    },
  };
}

async function runPermissionsCli(args: string[]) {
  const program = new Command();
  program.exitOverride();
  registerPermissionsCli(program);
  await program.parseAsync(args, { from: "user" });
}

describe("permissions CLI", () => {
  beforeEach(() => {
    mocks.readConfigFileSnapshot.mockReset().mockResolvedValue({
      path: "/tmp/kova.json",
      config: createConfig(),
    });
    mocks.readExecApprovalsSnapshot.mockReset().mockReturnValue({
      path: "/tmp/exec-approvals.json",
      exists: true,
      hash: "hash",
      file: {
        version: 1,
        defaults: {
          security: "allowlist",
          ask: "on-miss",
          askFallback: "deny",
        },
      },
    });
    mocks.log.mockReset();
    mocks.error.mockReset();
    mocks.exit.mockReset();
    mocks.writeJson.mockReset();
  });

  it("prints a terminal permission summary", async () => {
    await runPermissionsCli(["permissions"]);

    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining("Kova permissions"));
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining("profile: coding"));
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining("security allowlist"));
  });

  it("keeps json output to policy fields instead of dumping full config", async () => {
    await runPermissionsCli(["permissions", "--json"]);

    expect(mocks.writeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        configPath: "/tmp/kova.json",
        approvalsPath: "/tmp/exec-approvals.json",
        tools: expect.objectContaining({
          profile: "coding",
          workspaceOnly: true,
        }),
      }),
      0,
    );
    expect(mocks.writeJson.mock.calls[0]?.[0]).not.toHaveProperty("config");
  });
});
