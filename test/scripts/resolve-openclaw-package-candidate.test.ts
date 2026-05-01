import { describe, expect, it } from "vitest";
import {
  parseArgs,
  validateOpenClawPackageSpec,
} from "../../scripts/resolve-openclaw-package-candidate.mjs";

describe("resolve-openclaw-package-candidate", () => {
  it("accepts only OpenClaw release package specs for npm candidates", () => {
    expect(() => validateOpenClawPackageSpec("getkova@beta")).not.toThrow();
    expect(() => validateOpenClawPackageSpec("getkova@latest")).not.toThrow();
    expect(() => validateOpenClawPackageSpec("getkova@2026.4.27")).not.toThrow();
    expect(() => validateOpenClawPackageSpec("getkova@2026.4.27-1")).not.toThrow();
    expect(() => validateOpenClawPackageSpec("getkova@2026.4.27-beta.2")).not.toThrow();

    expect(() => validateOpenClawPackageSpec("@evil/getkova@1.0.0")).toThrow(
      "package_spec must be getkova@beta",
    );
    expect(() => validateOpenClawPackageSpec("getkova@canary")).toThrow(
      "package_spec must be getkova@beta",
    );
    expect(() => validateOpenClawPackageSpec("getkova@2026.04.27")).toThrow(
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
