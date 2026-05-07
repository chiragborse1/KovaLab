import { describe, expect, it } from "vitest";
import {
  getOfficialExternalPluginCatalogEntry,
  listOfficialExternalPluginCatalogEntries,
  resolveOfficialExternalPluginNpmSpec,
} from "./official-external-plugin-catalog.js";

describe("official external plugin catalog", () => {
  it("resolves official Kova plugin ids to npm packages", () => {
    expect(resolveOfficialExternalPluginNpmSpec("diagnostics-prometheus")).toBe(
      "@kovaai/diagnostics-prometheus",
    );
    expect(resolveOfficialExternalPluginNpmSpec("@kovaai/diagnostics-prometheus")).toBe(
      "@kovaai/diagnostics-prometheus",
    );
  });

  it("includes official external channel packages in the same lookup", () => {
    expect(resolveOfficialExternalPluginNpmSpec("discord")).toBe("@kovaai/discord");
  });

  it("deduplicates entries by plugin kind and id", () => {
    const entries = listOfficialExternalPluginCatalogEntries();
    const keys = entries.map((entry) => {
      const manifest = entry.openclaw;
      return `${entry.kind ?? "plugin"}:${manifest?.plugin?.id ?? manifest?.channel?.id}`;
    });

    expect(new Set(keys).size).toBe(keys.length);
    expect(getOfficialExternalPluginCatalogEntry("voice-call")?.name).toBe("@kovaai/voice-call");
  });
});
