import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfigIO, resetConfigRuntimeState } from "./io.js";
import { withTempHome, writeKovaConfig } from "./test-helpers.js";

const doctorRegistryMocks = vi.hoisted(() => ({
  applyPluginDoctorCompatibilityMigrations: vi.fn((config: Record<string, unknown>) => ({
    config,
    changes: [],
  })),
  collectRelevantDoctorPluginIds: vi.fn(() => [] as string[]),
  collectRelevantDoctorPluginIdsForTouchedPaths: vi.fn(() => [] as string[]),
  listPluginDoctorLegacyConfigRules: vi.fn(() => []),
}));

vi.mock("../plugins/doctor-contract-registry.js", () => doctorRegistryMocks);

const silentLogger = {
  warn: () => {},
  error: () => {},
};

describe("config io runtime hot path", () => {
  afterEach(() => {
    resetConfigRuntimeState();
    doctorRegistryMocks.applyPluginDoctorCompatibilityMigrations.mockClear();
    doctorRegistryMocks.collectRelevantDoctorPluginIds.mockClear();
    doctorRegistryMocks.collectRelevantDoctorPluginIdsForTouchedPaths.mockClear();
    doctorRegistryMocks.listPluginDoctorLegacyConfigRules.mockClear();
  });

  it("loads runtime config without collecting doctor-only plugin legacy rules", async () => {
    await withTempHome(async (home) => {
      await writeKovaConfig(home, {
        memorySearch: {
          provider: "local",
          fallback: "none",
        },
      });

      const cfg = createConfigIO({ logger: silentLogger }).loadConfig();

      expect(cfg.agents?.defaults?.memorySearch).toMatchObject({
        provider: "local",
        fallback: "none",
      });
      expect(doctorRegistryMocks.collectRelevantDoctorPluginIds).not.toHaveBeenCalled();
      expect(doctorRegistryMocks.listPluginDoctorLegacyConfigRules).not.toHaveBeenCalled();
    });
  });

  it("does not load plugin doctor compatibility for configured channels during runtime load", async () => {
    await withTempHome(async (home) => {
      await writeKovaConfig(home, {
        channels: {
          telegram: {
            botToken: "test-token",
          },
        },
      });

      const cfg = createConfigIO({ logger: silentLogger }).loadConfig();

      expect(cfg.channels?.telegram?.botToken).toBe("test-token");
      expect(doctorRegistryMocks.applyPluginDoctorCompatibilityMigrations).not.toHaveBeenCalled();
      expect(doctorRegistryMocks.listPluginDoctorLegacyConfigRules).not.toHaveBeenCalled();
    });
  });

  it("keeps plugin legacy diagnostics for config snapshots", async () => {
    await withTempHome(async (home) => {
      await writeKovaConfig(home, {
        gateway: {
          bind: "0.0.0.0",
        },
      });

      const snapshot = await createConfigIO({ logger: silentLogger }).readConfigFileSnapshot();

      expect(snapshot.valid).toBe(true);
      expect(snapshot.legacyIssues.some((issue) => issue.path === "gateway.bind")).toBe(true);
      expect(doctorRegistryMocks.collectRelevantDoctorPluginIds).toHaveBeenCalled();
      expect(doctorRegistryMocks.listPluginDoctorLegacyConfigRules).toHaveBeenCalled();
    });
  });
});
