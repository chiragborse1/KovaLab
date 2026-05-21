import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../config/config.js";
import { captureEnv } from "../test-utils/env.js";
import {
  writeBundleProbeMcpServer,
  writeClaudeBundle,
  writeFakeClaudeCli,
} from "./bundle-mcp.test-harness.js";
import { __testing as cliBackendsTesting } from "./cli-backends.js";
import {
  resetCliRunnerPrepareTestDepsForTest,
  setCliRunnerPrepareTestDeps,
} from "./cli-runner/prepare.js";

vi.mock("./cli-runner/helpers.js", async () => {
  const original =
    await vi.importActual<typeof import("./cli-runner/helpers.js")>("./cli-runner/helpers.js");
  return {
    ...original,
    // This e2e only validates bundle MCP wiring into the spawned CLI backend.
    // Stub the large prompt-construction path so cold Vitest workers do not
    // time out before the actual MCP roundtrip runs.
    buildSystemPrompt: () => "Bundle MCP e2e test prompt.",
  };
});

// This e2e spins a real stdio MCP server plus a spawned CLI process, which is
// notably slower under Docker and cold Vitest imports. The plugins Docker lane
// also reaches this test after several gateway/plugin restart exercises.
const E2E_TIMEOUT_MS = 180_000;

describe("runCliAgent bundle MCP e2e", () => {
  beforeEach(() => {
    cliBackendsTesting.setDepsForTest({
      resolveRuntimeCliBackends: () => [],
      resolvePluginSetupCliBackend: ({ backend }) =>
        backend === "claude-cli"
          ? {
              pluginId: "anthropic",
              backend: {
                id: "claude-cli",
                bundleMcp: true,
                bundleMcpMode: "claude-config-file",
                config: {
                  command: "claude",
                  args: ["-p"],
                  output: "jsonl",
                  input: "arg",
                  modelArg: "--model",
                  sessionArg: "--session-id",
                  sessionMode: "always",
                  sessionIdFields: ["session_id"],
                  clearEnv: [],
                },
              },
            }
          : undefined,
    });
    setCliRunnerPrepareTestDeps({
      makeBootstrapWarn: () => () => undefined,
      resolveBootstrapContextForRun: async () => ({ bootstrapFiles: [], contextFiles: [] }),
      getActiveMcpLoopbackRuntime: () => undefined,
      ensureMcpLoopbackServer: async () => ({ port: 0, close: async () => undefined }),
      createMcpLoopbackServerConfig: () => ({ mcpServers: {} }),
      resolveMcpLoopbackScopedTools: () => ({ agentId: undefined, tools: [] }),
      resolveKovaReferencePaths: async () => ({ docsPath: null, sourcePath: null }),
    });
  });

  afterEach(() => {
    cliBackendsTesting.resetDepsForTest();
    resetCliRunnerPrepareTestDepsForTest();
  });

  it(
    "routes enabled bundle MCP config into the claude-cli backend and executes the tool",
    { timeout: E2E_TIMEOUT_MS },
    async () => {
      const { runCliAgent } = await import("./cli-runner.js");
      const { resetGlobalHookRunner } = await import("../plugins/hook-runner-global.js");
      const envSnapshot = captureEnv(["HOME"]);
      const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), "kova-cli-bundle-mcp-"));
      process.env.HOME = tempHome;
      resetGlobalHookRunner();

      const workspaceDir = path.join(tempHome, "workspace");
      const sessionFile = path.join(tempHome, "session.jsonl");
      const binDir = path.join(tempHome, "bin");
      const serverScriptPath = path.join(tempHome, "mcp", "bundle-probe.mjs");
      const fakeClaudePath = path.join(binDir, "fake-claude.mjs");
      const pluginRoot = path.join(tempHome, ".kova", "extensions", "bundle-probe");
      await fs.mkdir(workspaceDir, { recursive: true });
      await writeBundleProbeMcpServer(serverScriptPath);
      await writeFakeClaudeCli(fakeClaudePath);
      await writeClaudeBundle({ pluginRoot, serverScriptPath });

      const config: KovaConfig = {
        agents: {
          defaults: {
            workspace: workspaceDir,
            cliBackends: {
              "claude-cli": {
                command: "node",
                args: [fakeClaudePath],
                clearEnv: [],
                input: "arg",
              },
            },
          },
        },
        plugins: {
          entries: {
            "bundle-probe": { enabled: true },
          },
        },
      };

      try {
        const result = await runCliAgent({
          sessionId: "session:test",
          sessionFile,
          workspaceDir,
          config,
          prompt: "Use your configured MCP tools and report the bundle probe text.",
          provider: "claude-cli",
          model: "test-bundle",
          timeoutMs: 45_000,
          runId: "bundle-mcp-e2e",
        });

        expect(result.payloads?.[0]?.text).toContain("BUNDLE MCP OK FROM-BUNDLE");
        expect(result.meta.agentMeta?.sessionId.length ?? 0).toBeGreaterThan(0);
      } finally {
        resetGlobalHookRunner();
        await fs.rm(tempHome, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
        envSnapshot.restore();
      }
    },
  );
});
