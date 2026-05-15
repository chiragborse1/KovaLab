import { describe, expect, it } from "vitest";
import { buildVitestCapabilityShimAliasMap } from "./bundled-capability-runtime.js";

describe("buildVitestCapabilityShimAliasMap", () => {
  it("keeps scoped and unscoped capability shim aliases aligned", () => {
    const aliasMap = buildVitestCapabilityShimAliasMap();

    expect(aliasMap["getkova/plugin-sdk/llm-task"]).toBe(aliasMap["@getkova/plugin-sdk/llm-task"]);
    expect(aliasMap["getkova/plugin-sdk/config-runtime"]).toBe(
      aliasMap["@getkova/plugin-sdk/config-runtime"],
    );
    expect(aliasMap["getkova/plugin-sdk/media-runtime"]).toBe(
      aliasMap["@getkova/plugin-sdk/media-runtime"],
    );
    expect(aliasMap["getkova/plugin-sdk/provider-onboard"]).toBe(
      aliasMap["@getkova/plugin-sdk/provider-onboard"],
    );
    expect(aliasMap["getkova/plugin-sdk/speech-core"]).toBe(
      aliasMap["@getkova/plugin-sdk/speech-core"],
    );
  });
});
