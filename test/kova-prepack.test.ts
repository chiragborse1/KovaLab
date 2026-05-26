import { describe, expect, it } from "vitest";
import { collectPreparedPrepackErrors } from "../scripts/kova-prepack.ts";

describe("collectPreparedPrepackErrors", () => {
  it("accepts prepared release artifacts", () => {
    expect(collectPreparedPrepackErrors(["dist/index.mjs"])).toEqual([]);
  });

  it("reports missing build artifacts", () => {
    expect(collectPreparedPrepackErrors([])).toEqual([
      "missing required prepared artifact: dist/index.js or dist/index.mjs",
    ]);
  });
});
