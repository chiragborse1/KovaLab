import { describe, expect, it, vi } from "vitest";
import { promptSetupExtraModules } from "./setup.extras.js";
import type { QuickstartGatewayDefaults } from "./setup.types.js";

const gatewayDefaults: QuickstartGatewayDefaults = {
  hasExisting: false,
  port: 18789,
  bind: "loopback",
  authMode: "token",
  token: "test-token",
  tailscaleMode: "off",
  tailscaleResetOnExit: false,
};

describe("promptSetupExtraModules", () => {
  it("keeps selected extras when the no-op default is still selected", async () => {
    const note = vi.fn(async () => undefined);
    const multiselect = vi.fn(async () => ["__none__", "web", "hooks"]);

    await expect(
      promptSetupExtraModules({
        config: {},
        workspaceDir: "/tmp/kova-workspace",
        gatewayDefaults,
        prompter: { note, multiselect },
      }),
    ).resolves.toEqual(["web", "hooks"]);
  });

  it("returns no extras when only the no-op default is selected", async () => {
    const note = vi.fn(async () => undefined);
    const multiselect = vi.fn(async () => ["__none__"]);

    await expect(
      promptSetupExtraModules({
        config: {},
        workspaceDir: "/tmp/kova-workspace",
        gatewayDefaults,
        prompter: { note, multiselect },
      }),
    ).resolves.toEqual([]);
  });
});
