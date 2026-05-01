import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pinIosVersion, parseArgs } from "../../scripts/ios-pin-version.ts";
import { resolveIosVersion } from "../../scripts/lib/ios-version.ts";
import { installIosFixtureCleanup, writeIosFixture } from "./ios-version.test-support.ts";

installIosFixtureCleanup();

describe("parseArgs", () => {
  it("requires exactly one pin source", () => {
    expect(() => parseArgs([])).toThrow(
      "Choose exactly one of --from-gateway or --version <X.Y.Z>",
    );
    expect(() => parseArgs(["--from-gateway", "--version", "0.2.1"])).toThrow(
      "Choose exactly one of --from-gateway or --version <X.Y.Z>",
    );
  });
});

describe("pinIosVersion", () => {
  it("pins an explicit iOS release version and syncs generated artifacts", () => {
    const rootDir = writeIosFixture({
      version: "0.2.0",
      changelog: `# OpenClaw iOS Changelog

## Unreleased

- Draft release notes.
`,
      prefix: "openclaw-ios-pin-",
    });

    const result = pinIosVersion({
      explicitVersion: "0.2.1",
      fromGateway: false,
      rootDir,
      sync: true,
    });

    expect(result.previousVersion).toBe("0.2.0");
    expect(result.nextVersion).toBe("0.2.1");
    expect(result.packageVersion).toBeNull();
    expect(resolveIosVersion(rootDir).canonicalVersion).toBe("0.2.1");
    expect(fs.readFileSync(path.join(rootDir, "apps", "ios", "version.json"), "utf8")).toContain(
      '"version": "0.2.1"',
    );
    expect(
      fs.readFileSync(path.join(rootDir, "apps", "ios", "Config", "Version.xcconfig"), "utf8"),
    ).toContain("OPENCLAW_MARKETING_VERSION = 0.2.1");
    expect(
      fs.readFileSync(
        path.join(rootDir, "apps", "ios", "fastlane", "metadata", "en-US", "release_notes.txt"),
        "utf8",
      ),
    ).toContain("- Draft release notes.");
    expect(result.syncedPaths).toHaveLength(2);
  });

  it("pins from the current gateway version without carrying prerelease suffixes", () => {
    const rootDir = writeIosFixture({
      version: "0.2.0",
      packageVersion: "0.2.3-beta.3",
      changelog: `# OpenClaw iOS Changelog

## Unreleased

- Candidate release notes.
`,
      prefix: "openclaw-ios-pin-",
    });

    const result = pinIosVersion({
      explicitVersion: null,
      fromGateway: true,
      rootDir,
      sync: true,
    });

    expect(result.previousVersion).toBe("0.2.0");
    expect(result.nextVersion).toBe("0.2.3");
    expect(result.packageVersion).toBe("0.2.3-beta.3");
    expect(resolveIosVersion(rootDir).marketingVersion).toBe("0.2.3");
  });

  it("can skip syncing checked-in artifacts when requested", () => {
    const rootDir = writeIosFixture({
      version: "0.2.0",
      changelog: `# OpenClaw iOS Changelog

## Unreleased

- Candidate release notes.
`,
      versionXcconfig: "stale\n",
      releaseNotes: "stale\n",
      prefix: "openclaw-ios-pin-",
    });

    const result = pinIosVersion({
      explicitVersion: "0.2.2",
      fromGateway: false,
      rootDir,
      sync: false,
    });

    expect(result.syncedPaths).toHaveLength(0);
    expect(
      fs.readFileSync(path.join(rootDir, "apps", "ios", "Config", "Version.xcconfig"), "utf8"),
    ).toBe("stale\n");
  });
});
