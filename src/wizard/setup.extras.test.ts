import { describe, expect, it, vi } from "vitest";
import type { WizardPrompter } from "./prompts.js";
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

function createPrompter(rawChoices: string[]): Pick<WizardPrompter, "note" | "multiselect"> {
  return {
    note: vi.fn(async () => undefined),
    async multiselect<T>() {
      return rawChoices as T[];
    },
  };
}

describe("promptSetupExtraModules", () => {
  it("keeps selected extras when the no-op default is still selected", async () => {
    const prompter = createPrompter(["__none__", "web", "hooks"]);

    await expect(
      promptSetupExtraModules({
        config: {},
        workspaceDir: "/tmp/kova-workspace",
        gatewayDefaults,
        prompter,
      }),
    ).resolves.toEqual(["web", "hooks"]);
  });

  it("returns no extras when only the no-op default is selected", async () => {
    const prompter = createPrompter(["__none__"]);

    await expect(
      promptSetupExtraModules({
        config: {},
        workspaceDir: "/tmp/kova-workspace",
        gatewayDefaults,
        prompter,
      }),
    ).resolves.toEqual([]);
  });
});
