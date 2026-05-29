import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  ensureStandaloneRuntimePluginRegistryLoaded: vi.fn(),
  getCurrentPluginMetadataSnapshot: vi.fn(),
  loadPluginLookUpTable: vi.fn(),
  getActivePluginRuntimeSubagentMode: vi.fn<() => "default" | "explicit" | "gateway-bindable">(
    () => "default",
  ),
}));

vi.mock("../plugins/current-plugin-metadata-snapshot.js", () => ({
  getCurrentPluginMetadataSnapshot: hoisted.getCurrentPluginMetadataSnapshot,
}));

vi.mock("../plugins/plugin-lookup-table.js", () => ({
  loadPluginLookUpTable: hoisted.loadPluginLookUpTable,
}));

vi.mock("../plugins/runtime.js", () => ({
  getActivePluginRuntimeSubagentMode: hoisted.getActivePluginRuntimeSubagentMode,
}));

vi.mock("../plugins/runtime/standalone-runtime-registry-loader.js", () => ({
  ensureStandaloneRuntimePluginRegistryLoaded: hoisted.ensureStandaloneRuntimePluginRegistryLoaded,
}));

describe("ensureRuntimePluginsLoaded", () => {
  let ensureRuntimePluginsLoaded: typeof import("./runtime-plugins.js").ensureRuntimePluginsLoaded;

  beforeEach(async () => {
    hoisted.ensureStandaloneRuntimePluginRegistryLoaded.mockReset();
    hoisted.getCurrentPluginMetadataSnapshot.mockReset();
    hoisted.getCurrentPluginMetadataSnapshot.mockReturnValue(undefined);
    hoisted.loadPluginLookUpTable.mockReset();
    hoisted.loadPluginLookUpTable.mockReturnValue({
      startup: {
        pluginIds: ["telegram", "memory-core"],
      },
    });
    hoisted.getActivePluginRuntimeSubagentMode.mockReset();
    hoisted.getActivePluginRuntimeSubagentMode.mockReturnValue("default");
    vi.resetModules();
    ({ ensureRuntimePluginsLoaded } = await import("./runtime-plugins.js"));
  });

  it("uses startup plugin ids from the current metadata snapshot", async () => {
    hoisted.getCurrentPluginMetadataSnapshot.mockReturnValue({
      startup: {
        pluginIds: ["telegram"],
      },
    });

    ensureRuntimePluginsLoaded({
      config: {} as never,
      workspaceDir: "/tmp/workspace",
      allowGatewaySubagentBinding: true,
    });

    expect(hoisted.loadPluginLookUpTable).not.toHaveBeenCalled();
    expect(hoisted.ensureStandaloneRuntimePluginRegistryLoaded).toHaveBeenCalledWith({
      requiredPluginIds: ["telegram"],
      loadOptions: {
        config: {} as never,
        workspaceDir: "/tmp/workspace",
        onlyPluginIds: ["telegram"],
        runtimeOptions: {
          allowGatewaySubagentBinding: true,
        },
      },
    });
  });

  it("falls back to the metadata lookup table when the current snapshot has no startup plan", async () => {
    ensureRuntimePluginsLoaded({
      config: {} as never,
      workspaceDir: "/tmp/workspace",
      allowGatewaySubagentBinding: true,
    });

    expect(hoisted.loadPluginLookUpTable).toHaveBeenCalledWith({
      config: {} as never,
      activationSourceConfig: {} as never,
      workspaceDir: "/tmp/workspace",
      env: process.env,
      metadataSnapshot: undefined,
    });
    expect(hoisted.ensureStandaloneRuntimePluginRegistryLoaded).toHaveBeenCalledWith({
      requiredPluginIds: ["telegram", "memory-core"],
      loadOptions: {
        config: {} as never,
        workspaceDir: "/tmp/workspace",
        onlyPluginIds: ["telegram", "memory-core"],
        runtimeOptions: {
          allowGatewaySubagentBinding: true,
        },
      },
    });
  });

  it("does not enable gateway subagent binding for normal runtime loads", async () => {
    ensureRuntimePluginsLoaded({
      config: {} as never,
      workspaceDir: "/tmp/workspace",
    });

    expect(hoisted.ensureStandaloneRuntimePluginRegistryLoaded).toHaveBeenCalledWith({
      requiredPluginIds: ["telegram", "memory-core"],
      loadOptions: {
        config: {} as never,
        workspaceDir: "/tmp/workspace",
        onlyPluginIds: ["telegram", "memory-core"],
        runtimeOptions: undefined,
      },
    });
  });

  it("inherits gateway-bindable mode from an active gateway registry", async () => {
    hoisted.getActivePluginRuntimeSubagentMode.mockReturnValue("gateway-bindable");

    ensureRuntimePluginsLoaded({
      config: {} as never,
      workspaceDir: "/tmp/workspace",
    });

    expect(hoisted.ensureStandaloneRuntimePluginRegistryLoaded).toHaveBeenCalledWith({
      requiredPluginIds: ["telegram", "memory-core"],
      loadOptions: {
        config: {} as never,
        workspaceDir: "/tmp/workspace",
        onlyPluginIds: ["telegram", "memory-core"],
        runtimeOptions: {
          allowGatewaySubagentBinding: true,
        },
      },
    });
  });
});
