import { describe, expect, it } from "vitest";
import { isNixStorePluginRoot, shouldRejectHardlinkedPluginFiles } from "./hardlink-policy.js";

const nixEnv: NodeJS.ProcessEnv = { KOVA_NIX_MODE: "1" };

describe("plugin hardlink policy", () => {
  it("does not reject bundled plugin files", () => {
    expect(
      shouldRejectHardlinkedPluginFiles({
        origin: "bundled",
        rootDir: "/tmp/plugin",
        env: {},
      }),
    ).toBe(false);
  });

  it("rejects hardlinked external plugin files by default", () => {
    expect(
      shouldRejectHardlinkedPluginFiles({
        origin: "config",
        rootDir: "/tmp/plugin",
        env: {},
      }),
    ).toBe(true);
  });

  it("does not treat Nix mode as enough by itself", () => {
    expect(
      shouldRejectHardlinkedPluginFiles({
        origin: "config",
        rootDir: "/tmp/plugin",
        env: nixEnv,
      }),
    ).toBe(true);
  });

  it.runIf(process.platform !== "win32")(
    "does not reject hardlinked external plugin files when Nix mode loads from the Nix store",
    () => {
      expect(isNixStorePluginRoot("/nix/store/abc-kova-plugin")).toBe(true);
      expect(isNixStorePluginRoot("/tmp/nix/store/abc-kova-plugin")).toBe(false);
      expect(
        shouldRejectHardlinkedPluginFiles({
          origin: "config",
          rootDir: "/nix/store/abc-kova-plugin",
          env: nixEnv,
        }),
      ).toBe(false);
    },
  );
});
