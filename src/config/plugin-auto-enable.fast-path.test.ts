import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadPluginManifestRegistryForPluginRegistry: vi.fn(() => {
    throw new Error("manifest registry should not load on empty auto-enable candidates");
  }),
}));

vi.mock("../plugins/plugin-registry.js", async () => {
  const actual = await vi.importActual<typeof import("../plugins/plugin-registry.js")>(
    "../plugins/plugin-registry.js",
  );
  return {
    ...actual,
    loadPluginManifestRegistryForPluginRegistry: mocks.loadPluginManifestRegistryForPluginRegistry,
  };
});

const { materializePluginAutoEnableCandidates } = await import("./plugin-auto-enable.apply.js");

describe("plugin auto-enable fast path", () => {
  it("does not build the plugin manifest registry when there are no candidates", () => {
    const config = { plugins: { allow: ["telegram"] } };
    const result = materializePluginAutoEnableCandidates({
      config,
      candidates: [],
      env: {},
    });

    expect(result).toEqual({ config, changes: [], autoEnabledReasons: {} });
    expect(mocks.loadPluginManifestRegistryForPluginRegistry).not.toHaveBeenCalled();
  });
});
