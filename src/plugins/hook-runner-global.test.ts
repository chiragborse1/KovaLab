import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockPluginRegistry } from "./hooks.test-helpers.js";

async function importHookRunnerGlobalModule() {
  return import("./hook-runner-global.js");
}

async function expectGlobalRunnerState(expected: { hasRunner: boolean; registry?: unknown }) {
  const mod = await importHookRunnerGlobalModule();
  expect(mod.getGlobalHookRunner() === null).toBe(!expected.hasRunner);
  if ("registry" in expected) {
    expect(mod.getGlobalPluginRegistry()).toBe(expected.registry ?? null);
  }
  return mod;
}

afterEach(async () => {
  const mod = await importHookRunnerGlobalModule();
  mod.resetGlobalHookRunner();
});

describe("hook-runner-global", () => {
  async function createInitializedModule() {
    const modA = await importHookRunnerGlobalModule();
    const registry = createMockPluginRegistry([{ hookName: "message_received", handler: vi.fn() }]);
    modA.initializeGlobalHookRunner(registry);
    return { modA, registry };
  }

  it("preserves the initialized runner across module reloads", async () => {
    const { modA, registry } = await createInitializedModule();
    expect(modA.getGlobalHookRunner()?.hasHooks("message_received")).toBe(true);

    vi.resetModules();

    const modB = await expectGlobalRunnerState({ hasRunner: true, registry });
    expect(modB.getGlobalHookRunner()).not.toBeNull();
    expect(modB.getGlobalHookRunner()?.hasHooks("message_received")).toBe(true);
  });

  it("clears the shared state across module reloads", async () => {
    await createInitializedModule();

    vi.resetModules();

    const modB = await expectGlobalRunnerState({ hasRunner: true });
    modB.resetGlobalHookRunner();
    expect(modB.getGlobalHookRunner()).toBeNull();
    expect(modB.getGlobalPluginRegistry()).toBeNull();

    vi.resetModules();

    await expectGlobalRunnerState({ hasRunner: false });
  });

  it("replays gateway_start for hook runners initialized after gateway startup", async () => {
    const mod = await importHookRunnerGlobalModule();
    const firstGatewayStart = vi.fn();
    const firstRegistry = createMockPluginRegistry([
      { hookName: "gateway_start", handler: firstGatewayStart },
    ]);
    mod.initializeGlobalHookRunner(firstRegistry, { runtimeSubagentMode: "gateway-bindable" });

    const event = { port: 18789 };
    const ctx = {
      port: 18789,
      config: {},
      workspaceDir: "/tmp/kova-test",
      getCron: () => undefined,
    };
    await mod.runGlobalGatewayStartSafely({ event, ctx });
    expect(firstGatewayStart).toHaveBeenCalledTimes(1);

    const reloadedGatewayStart = vi.fn();
    const reloadedRegistry = createMockPluginRegistry([
      { hookName: "gateway_start", handler: reloadedGatewayStart },
    ]);
    mod.initializeGlobalHookRunner(reloadedRegistry, { runtimeSubagentMode: "gateway-bindable" });

    await vi.waitFor(() => {
      expect(reloadedGatewayStart).toHaveBeenCalledTimes(1);
    });
    expect(reloadedGatewayStart).toHaveBeenCalledWith(event, ctx);
  });
});
