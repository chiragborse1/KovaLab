import { describe, expect, it } from "vitest";
import type { KovaConfig } from "../config/config.js";
import { resolvePluginUninstallId } from "./plugins-uninstall-selection.js";

describe("resolvePluginUninstallId", () => {
  it("accepts the recorded KovaHub spec as an uninstall target", () => {
    const result = resolvePluginUninstallId({
      rawId: "kovahub:linkmind-context",
      config: {
        plugins: {
          entries: {
            "linkmind-context": { enabled: true },
          },
          installs: {
            "linkmind-context": {
              source: "npm",
              spec: "kovahub:linkmind-context",
              kovahubPackage: "linkmind-context",
            },
          },
        },
      } as KovaConfig,
      plugins: [{ id: "linkmind-context", name: "linkmind-context" }],
    });

    expect(result.pluginId).toBe("linkmind-context");
  });

  it("accepts a versionless KovaHub spec when the install was pinned", () => {
    const result = resolvePluginUninstallId({
      rawId: "kovahub:linkmind-context",
      config: {
        plugins: {
          entries: {
            "linkmind-context": { enabled: true },
          },
          installs: {
            "linkmind-context": {
              source: "npm",
              spec: "kovahub:linkmind-context@1.2.3",
            },
          },
        },
      } as KovaConfig,
      plugins: [{ id: "linkmind-context", name: "linkmind-context" }],
    });

    expect(result.pluginId).toBe("linkmind-context");
  });
});
