import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerSubCliByName, registerSubCliCommands } from "./register.subclis.js";

const { acpAction, registerAcpCli } = vi.hoisted(() => {
  const action = vi.fn();
  const register = vi.fn((program: Command) => {
    program.command("acp").action(action);
  });
  return { acpAction: action, registerAcpCli: register };
});

const { nodesAction, registerNodesCli } = vi.hoisted(() => {
  const action = vi.fn();
  const register = vi.fn((program: Command) => {
    const nodes = program.command("nodes");
    nodes.command("list").action(action);
  });
  return { nodesAction: action, registerNodesCli: register };
});

const { registerQaLabCli } = vi.hoisted(() => ({
  registerQaLabCli: vi.fn((program: Command) => {
    const qa = program.command("qa");
    qa.command("run").action(() => undefined);
  }),
}));
const { loadPrivateQaCliModule } = vi.hoisted(() => ({
  loadPrivateQaCliModule: vi.fn(async () => ({ registerQaLabCli })),
}));

const { inferAction, registerCapabilityCli } = vi.hoisted(() => {
  const action = vi.fn();
  const register = vi.fn((program: Command) => {
    program.command("infer").alias("capability").action(action);
  });
  return { inferAction: action, registerCapabilityCli: register };
});

const { registerPluginsCli, registerPluginCliCommandsFromValidatedConfig } = vi.hoisted(() => ({
  registerPluginsCli: vi.fn((program: Command) => {
    const plugins = program.command("plugins");
    plugins
      .command("update")
      .argument("[id]")
      .action(() => undefined);
  }),
  registerPluginCliCommandsFromValidatedConfig: vi.fn(async () => null),
}));

vi.mock("../acp-cli.js", () => ({ registerAcpCli }));
vi.mock("../nodes-cli.js", () => ({ registerNodesCli }));
vi.mock("../capability-cli.js", () => ({ registerCapabilityCli }));
vi.mock("../plugins-cli.js", () => ({ registerPluginsCli }));
vi.mock("../../plugins/cli.js", () => ({ registerPluginCliCommandsFromValidatedConfig }));
vi.mock("./private-qa-cli.js", async () => {
  const actual = await vi.importActual<typeof import("./private-qa-cli.js")>("./private-qa-cli.js");
  return {
    ...actual,
    loadPrivateQaCliModule,
  };
});

describe("registerSubCliCommands", () => {
  const originalArgv = process.argv;
  const originalDisableLazySubcommands = process.env.KOVA_DISABLE_LAZY_SUBCOMMANDS;
  const originalEnablePrivateQaCli = process.env.KOVA_ENABLE_PRIVATE_QA_CLI;

  const createRegisteredProgram = (argv: string[], name?: string) => {
    process.argv = argv;
    const program = new Command();
    if (name) {
      program.name(name);
    }
    registerSubCliCommands(program, process.argv);
    return program;
  };

  beforeEach(() => {
    if (originalDisableLazySubcommands === undefined) {
      delete process.env.KOVA_DISABLE_LAZY_SUBCOMMANDS;
    } else {
      process.env.KOVA_DISABLE_LAZY_SUBCOMMANDS = originalDisableLazySubcommands;
    }
    process.env.KOVA_ENABLE_PRIVATE_QA_CLI = "1";
    registerAcpCli.mockClear();
    acpAction.mockClear();
    registerNodesCli.mockClear();
    nodesAction.mockClear();
    registerQaLabCli.mockClear();
    loadPrivateQaCliModule.mockClear();
    registerCapabilityCli.mockClear();
    inferAction.mockClear();
    registerPluginsCli.mockClear();
    registerPluginCliCommandsFromValidatedConfig.mockClear();
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalDisableLazySubcommands === undefined) {
      delete process.env.KOVA_DISABLE_LAZY_SUBCOMMANDS;
    } else {
      process.env.KOVA_DISABLE_LAZY_SUBCOMMANDS = originalDisableLazySubcommands;
    }
    if (originalEnablePrivateQaCli === undefined) {
      delete process.env.KOVA_ENABLE_PRIVATE_QA_CLI;
    } else {
      process.env.KOVA_ENABLE_PRIVATE_QA_CLI = originalEnablePrivateQaCli;
    }
  });

  it("registers the primary placeholder plus completion and dispatches", async () => {
    const program = createRegisteredProgram(["node", "kova", "acp"]);

    expect(program.commands.map((cmd) => cmd.name())).toEqual(["acp", "completion"]);

    await program.parseAsync(["acp"], { from: "user" });

    expect(registerAcpCli).toHaveBeenCalledTimes(1);
    expect(acpAction).toHaveBeenCalledTimes(1);
  });

  it("registers placeholders for all subcommands when no primary", () => {
    const program = createRegisteredProgram(["node", "kova"]);

    const names = program.commands.map((cmd) => cmd.name());
    expect(names).toContain("acp");
    expect(names).toContain("gateway");
    expect(names).toContain("kova");
    expect(names).toContain("qa");
    expect(registerAcpCli).not.toHaveBeenCalled();
  });

  it("keeps legacy aliases callable but hidden from root help", () => {
    const program = createRegisteredProgram(["node", "kova"]);

    const help = program.helpInformation();

    expect(program.commands.map((cmd) => cmd.name())).toContain("kova");
    expect(program.commands.map((cmd) => cmd.name())).toContain("daemon");
    expect(help).not.toContain("kova");
    expect(help).not.toContain("daemon");
  });

  it("omits the qa placeholder when the private qa cli is disabled", () => {
    delete process.env.KOVA_ENABLE_PRIVATE_QA_CLI;

    const program = createRegisteredProgram(["node", "kova"]);

    expect(program.commands.map((cmd) => cmd.name())).not.toContain("qa");
  });

  it("re-parses argv for lazy subcommands", async () => {
    const program = createRegisteredProgram(["node", "kova", "nodes", "list"], "kova");

    expect(program.commands.map((cmd) => cmd.name())).toEqual(["nodes", "completion"]);

    await program.parseAsync(["nodes", "list"], { from: "user" });

    expect(registerNodesCli).toHaveBeenCalledTimes(1);
    expect(nodesAction).toHaveBeenCalledTimes(1);
  });

  it("registers the infer placeholder and dispatches through the capability registrar", async () => {
    const program = createRegisteredProgram(["node", "kova", "infer"], "kova");

    expect(program.commands.map((cmd) => cmd.name())).toEqual(["infer", "completion"]);

    await program.parseAsync(["infer"], { from: "user" });

    expect(registerCapabilityCli).toHaveBeenCalledTimes(1);
    expect(inferAction).toHaveBeenCalledTimes(1);
  });

  it("replaces placeholder when registering a subcommand by name", async () => {
    const program = createRegisteredProgram(["node", "kova", "acp", "--help"], "kova");

    await registerSubCliByName(program, "acp");

    const names = program.commands.map((cmd) => cmd.name());
    expect(names.filter((name) => name === "acp")).toHaveLength(1);

    await program.parseAsync(["acp"], { from: "user" });
    expect(registerAcpCli).toHaveBeenCalledTimes(1);
    expect(acpAction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["plugins update", ["plugins", "update", "lossless-claw"]],
    ["plugins update --all", ["plugins", "update", "--all"]],
    ["plugins install", ["plugins", "install", "lossless-claw"]],
    ["plugins list", ["plugins", "list"]],
    ["plugins inspect", ["plugins", "inspect", "lossless-claw"]],
    ["plugins registry --refresh", ["plugins", "registry", "--refresh"]],
    ["plugins doctor", ["plugins", "doctor"]],
    ["plugins --help", ["plugins", "--help"]],
  ])("does not preload plugin CLI registrations for builtin %s", async (_label, args) => {
    process.argv = ["node", "kova", ...args];
    const program = new Command().name("kova");

    await registerSubCliByName(program, "plugins");

    expect(registerPluginsCli).toHaveBeenCalledTimes(1);
    expect(registerPluginCliCommandsFromValidatedConfig).not.toHaveBeenCalled();
  });

  it("keeps plugin CLI registrations available for the plugins command root", async () => {
    process.argv = ["node", "kova", "plugins"];
    const program = new Command().name("kova");

    await registerSubCliByName(program, "plugins");

    expect(registerPluginsCli).toHaveBeenCalledTimes(1);
    expect(registerPluginCliCommandsFromValidatedConfig).toHaveBeenCalledTimes(1);
  });
});
