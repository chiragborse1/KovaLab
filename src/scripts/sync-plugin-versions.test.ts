import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncPluginVersions } from "../../scripts/sync-plugin-versions.js";
import { cleanupTempDirs, makeTempDir } from "../../test/helpers/temp-dir.js";

const tempDirs: string[] = [];

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("syncPluginVersions", () => {
  afterEach(() => {
    cleanupTempDirs(tempDirs);
  });

  it("preserves workspace kova devDependencies and aligns impossible host floors", () => {
    const rootDir = makeTempDir(tempDirs, "kova-sync-plugin-versions-");

    writeJson(path.join(rootDir, "package.json"), {
      name: "getkova",
      version: "2.0.0",
    });
    writeJson(path.join(rootDir, "extensions/bluebubbles/package.json"), {
      name: "@kovaai/bluebubbles",
      version: "2026.3.30",
      devDependencies: {
        kova: "workspace:*",
      },
      peerDependencies: {
        kova: ">=2026.3.30",
      },
      kova: {
        install: {
          minHostVersion: ">=2026.3.30",
        },
        compat: {
          pluginApi: ">=2026.3.30",
        },
        build: {
          kovaVersion: "2026.3.30",
        },
      },
    });

    const summary = syncPluginVersions(rootDir);
    const updatedPackage = JSON.parse(
      fs.readFileSync(path.join(rootDir, "extensions/bluebubbles/package.json"), "utf8"),
    ) as {
      version?: string;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      kova?: {
        install?: {
          minHostVersion?: string;
        };
        compat?: {
          pluginApi?: string;
        };
        build?: {
          kovaVersion?: string;
        };
      };
    };

    expect(summary.updated).toContain("@kovaai/bluebubbles");
    expect(updatedPackage.version).toBe("2.0.0");
    expect(updatedPackage.devDependencies?.kova).toBe("workspace:*");
    expect(updatedPackage.peerDependencies?.kova).toBe(">=2.0.0");
    expect(updatedPackage.kova?.install?.minHostVersion).toBe(">=2.0.0");
    expect(updatedPackage.kova?.compat?.pluginApi).toBe(">=2.0.0");
    expect(updatedPackage.kova?.build?.kovaVersion).toBe("2.0.0");
  });
});
