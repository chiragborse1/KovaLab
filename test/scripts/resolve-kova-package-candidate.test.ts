import { describe, expect, it } from "vitest";
import {
  parseArgs,
  validateKovaPackageSpec,
} from "../../scripts/resolve-kova-package-candidate.mjs";

describe("resolve-kova-package-candidate", () => {
  it("accepts only Kova release package specs for npm candidates", () => {
    expect(() => validateKovaPackageSpec("getkova@beta")).not.toThrow();
    expect(() => validateKovaPackageSpec("getkova@latest")).not.toThrow();
    expect(() => validateKovaPackageSpec("getkova@0.2.0")).not.toThrow();
    expect(() => validateKovaPackageSpec("getkova@0.2.0-beta.2")).not.toThrow();
    expect(() => validateKovaPackageSpec("getkova@2026.4.27")).not.toThrow();
    expect(() => validateKovaPackageSpec("getkova@2026.4.27-1")).not.toThrow();
    expect(() => validateKovaPackageSpec("getkova@2026.4.27-beta.2")).not.toThrow();

    expect(() => validateKovaPackageSpec("@evil/getkova@1.0.0")).toThrow(
      "package_spec must be getkova@beta",
    );
    expect(() => validateKovaPackageSpec("getkova@canary")).toThrow(
      "package_spec must be getkova@beta",
    );
    expect(() => validateKovaPackageSpec("getkova@2026.04.27")).toThrow(
      "package_spec must be getkova@beta",
    );
    expect(() => validateKovaPackageSpec("getkova@0.2")).toThrow(
      "package_spec must be getkova@beta",
    );
  });

  it("parses optional empty workflow inputs without rejecting the command line", () => {
    expect(
      parseArgs([
        "--source",
        "npm",
        "--package-ref",
        "release/2026.4.27",
        "--package-spec",
        "getkova@beta",
        "--package-url",
        "",
        "--package-sha256",
        "",
        "--artifact-dir",
        ".",
        "--output-dir",
        ".artifacts/docker-e2e-package",
      ]),
    ).toMatchObject({
      artifactDir: ".",
      outputDir: ".artifacts/docker-e2e-package",
      packageSha256: "",
      packageRef: "release/2026.4.27",
      packageSpec: "getkova@beta",
      packageUrl: "",
      source: "npm",
    });
  });
});
