import { describe, expect, it, vi } from "vitest";
import type { KovaConfig } from "../../config/types.kova.js";
import { createDiagnosticsCommandHandler } from "./commands-diagnostics.js";
import { baseCommandTestConfig, buildCommandTestParams } from "./commands.test-harness.js";

function buildDiagnosticsParams(commandBody = "/diagnostics") {
  return buildCommandTestParams(commandBody, {
    ...baseCommandTestConfig,
    tools: { exec: { timeoutSec: 30 } },
  } as KovaConfig);
}

describe("diagnostics command", () => {
  it("requests an approval-backed gateway diagnostics export from direct chats", async () => {
    const execute = vi.fn(async () => ({
      content: [{ type: "text", text: '{"path":"/tmp/kova-diagnostics.zip"}' }],
      details: {
        status: "completed",
        exitCode: 0,
        durationMs: 12,
        aggregated: "exported",
      },
    }));
    const createExecTool = vi.fn(() => ({ execute }));
    const handler = createDiagnosticsCommandHandler({ createExecTool: createExecTool as never });

    const result = await handler(buildDiagnosticsParams(), true);

    expect(createExecTool).toHaveBeenCalledWith(
      expect.objectContaining({
        ask: "always",
        host: "gateway",
        security: "allowlist",
        trigger: "diagnostics",
        timeoutSec: 30,
      }),
    );
    expect(execute).toHaveBeenCalledWith(
      "chat-diagnostics-gateway-export",
      expect.objectContaining({
        ask: "always",
        background: true,
        security: "allowlist",
        timeout: 30,
      }),
    );
    expect(execute.mock.calls[0]?.[1]?.command).toContain("gateway");
    expect(execute.mock.calls[0]?.[1]?.command).toContain("diagnostics");
    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply?.text).toContain("Diagnostics can include sensitive local logs");
    expect(result?.reply?.text).toContain("kova gateway diagnostics export --json");
    expect(result?.reply?.text).toContain("/tmp/kova-diagnostics.zip");
  });

  it("does not post diagnostics approval details into group chats", async () => {
    const createExecTool = vi.fn();
    const handler = createDiagnosticsCommandHandler({ createExecTool: createExecTool as never });
    const params = buildDiagnosticsParams();
    params.isGroup = true;

    const result = await handler(params, true);

    expect(createExecTool).not.toHaveBeenCalled();
    expect(result?.shouldContinue).toBe(false);
    expect(result?.reply?.text).toContain("Run /diagnostics from an owner DM");
  });

  it("does not add a duplicate reply while exec approval is pending", async () => {
    const execute = vi.fn(async () => ({
      details: {
        status: "approval-pending",
        approvalId: "approval-1",
        approvalSlug: "abc123",
        expiresAtMs: Date.now() + 60_000,
        host: "gateway",
        command: "kova gateway diagnostics export --json",
      },
    }));
    const handler = createDiagnosticsCommandHandler({
      createExecTool: vi.fn(() => ({ execute })) as never,
    });

    const result = await handler(buildDiagnosticsParams(), true);

    expect(result).toEqual({ shouldContinue: false });
  });

  it("ignores non-diagnostics commands", async () => {
    const handler = createDiagnosticsCommandHandler({ createExecTool: vi.fn() as never });

    await expect(handler(buildDiagnosticsParams("/status"), true)).resolves.toBeNull();
  });
});
