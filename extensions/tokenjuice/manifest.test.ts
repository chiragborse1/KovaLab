import fs from "node:fs";
import { describe, expect, it } from "vitest";

type TokenjuicePackageManifest = {
  dependencies?: Record<string, string>;
  kova?: {
    bundle?: {
      stageRuntimeDependencies?: boolean;
    };
  };
};

type TokenjuicePluginManifest = {
  contracts?: {
    agentToolResultMiddleware?: string[];
  };
};

describe("tokenjuice package manifest", () => {
  it("opts into staging bundled runtime dependencies", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(new URL("./package.json", import.meta.url), "utf8"),
    ) as TokenjuicePackageManifest;

    expect(packageJson.dependencies?.tokenjuice).toBe("0.6.3");
    expect(packageJson.kova?.bundle?.stageRuntimeDependencies).toBe(true);
  });

  it("declares runtime-neutral tool result middleware ownership in the manifest contract", () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL("./kova.plugin.json", import.meta.url), "utf8"),
    ) as TokenjuicePluginManifest;

    expect(manifest.contracts?.agentToolResultMiddleware).toEqual(["pi", "codex"]);
  });
});
