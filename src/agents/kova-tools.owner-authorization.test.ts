import { describe, expect, it } from "vitest";
import {
  isKovaOwnerOnlyCoreToolName,
  KOVA_OWNER_ONLY_CORE_TOOL_NAMES,
} from "./tools/owner-only-tools.js";

describe("createKovaTools owner authorization", () => {
  it("marks owner-only core tool names", () => {
    expect(KOVA_OWNER_ONLY_CORE_TOOL_NAMES).toEqual(["cron", "gateway", "nodes"]);
    expect(isKovaOwnerOnlyCoreToolName("cron")).toBe(true);
    expect(isKovaOwnerOnlyCoreToolName("gateway")).toBe(true);
    expect(isKovaOwnerOnlyCoreToolName("nodes")).toBe(true);
  });

  it("keeps canvas non-owner-only", () => {
    expect(isKovaOwnerOnlyCoreToolName("canvas")).toBe(false);
  });
});
