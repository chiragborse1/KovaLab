import { describe, expect, it } from "vitest";
import { normalizePackageTagInput } from "./package-tag.js";

describe("normalizePackageTagInput", () => {
  const packageNames = ["getkova", "kova", "@kovaai/plugin"] as const;

  it.each([
    { input: undefined, expected: null },
    { input: "   ", expected: null },
    { input: "getkova@beta", expected: "beta" },
    { input: "kova@beta", expected: "beta" },
    { input: "@kovaai/plugin@2026.2.24", expected: "2026.2.24" },
    { input: "getkova@   ", expected: null },
    { input: "kova@   ", expected: null },
    { input: "getkova", expected: null },
    { input: "kova", expected: null },
    { input: " @kovaai/plugin ", expected: null },
    { input: " latest ", expected: "latest" },
    { input: "@other/plugin@beta", expected: "@other/plugin@beta" },
    { input: "kovaer@beta", expected: "kovaer@beta" },
  ] satisfies ReadonlyArray<{ input: string | undefined; expected: string | null }>)(
    "normalizes %j",
    ({ input, expected }) => {
      expect(normalizePackageTagInput(input, packageNames)).toBe(expected);
    },
  );
});
