import { describe, expect, it } from "vitest";
import {
  compareKovaVersions,
  isSameKovaStableFamily,
  parseKovaVersion,
  shouldWarnOnTouchedVersion,
} from "./version.js";

describe("parseKovaVersion", () => {
  it("parses stable, correction, and beta forms", () => {
    expect(parseKovaVersion("2026.3.23")).toEqual({
      major: 2026,
      minor: 3,
      patch: 23,
      revision: null,
      prerelease: null,
    });
    expect(parseKovaVersion("2026.3.23-1")).toEqual({
      major: 2026,
      minor: 3,
      patch: 23,
      revision: 1,
      prerelease: null,
    });
    expect(parseKovaVersion("2026.3.23-beta.1")).toEqual({
      major: 2026,
      minor: 3,
      patch: 23,
      revision: null,
      prerelease: ["beta", "1"],
    });
    expect(parseKovaVersion("v2026.3.23.beta.2")).toEqual({
      major: 2026,
      minor: 3,
      patch: 23,
      revision: null,
      prerelease: ["beta", "2"],
    });
  });

  it("rejects invalid versions", () => {
    expect(parseKovaVersion("2026.3")).toBeNull();
    expect(parseKovaVersion("latest")).toBeNull();
  });
});

describe("compareKovaVersions", () => {
  it("treats correction publishes as newer than the base stable release", () => {
    expect(compareKovaVersions("2026.3.23", "2026.3.23-1")).toBe(-1);
    expect(compareKovaVersions("2026.3.23-1", "2026.3.23")).toBe(1);
    expect(compareKovaVersions("2026.3.23-2", "2026.3.23-1")).toBe(1);
  });

  it("treats stable as newer than beta and compares beta identifiers", () => {
    expect(compareKovaVersions("2026.3.23", "2026.3.23-beta.1")).toBe(1);
    expect(compareKovaVersions("2026.3.23-beta.2", "2026.3.23-beta.1")).toBe(1);
    expect(compareKovaVersions("2026.3.23.beta.1", "2026.3.23-beta.2")).toBe(-1);
  });

  it("treats modern Kova semver releases as newer than legacy Kova calver releases", () => {
    expect(compareKovaVersions("2.0.0", "2026.4.26")).toBe(1);
    expect(compareKovaVersions("2026.4.26", "2.0.0")).toBe(-1);
  });
});

describe("isSameKovaStableFamily", () => {
  it("treats same-base stable and correction versions as one family", () => {
    expect(isSameKovaStableFamily("2026.3.23", "2026.3.23-1")).toBe(true);
    expect(isSameKovaStableFamily("2026.3.23-1", "2026.3.23-2")).toBe(true);
    expect(isSameKovaStableFamily("2026.3.23", "2026.3.24")).toBe(false);
    expect(isSameKovaStableFamily("2026.3.23-beta.1", "2026.3.23")).toBe(false);
  });
});

describe("shouldWarnOnTouchedVersion", () => {
  it("skips same-base stable families", () => {
    expect(shouldWarnOnTouchedVersion("2026.3.23", "2026.3.23-1")).toBe(false);
    expect(shouldWarnOnTouchedVersion("2026.3.23-1", "2026.3.23-2")).toBe(false);
  });

  it("skips same-base correction publishes even when current is a prerelease", () => {
    expect(shouldWarnOnTouchedVersion("2026.3.23-beta.1", "2026.3.23-1")).toBe(false);
  });

  it("skips same-base prerelease configs when current is newer", () => {
    expect(shouldWarnOnTouchedVersion("2026.3.23", "2026.3.23-beta.1")).toBe(false);
  });

  it("warns when the touched config is newer", () => {
    expect(shouldWarnOnTouchedVersion("2026.3.23-beta.1", "2026.3.23")).toBe(true);
    expect(shouldWarnOnTouchedVersion("2026.3.23", "2026.3.24")).toBe(true);
    expect(shouldWarnOnTouchedVersion("2026.3.23", "2027.1.1")).toBe(true);
  });

  it("treats Kova semver configs as the successor to legacy Kova calver configs", () => {
    expect(shouldWarnOnTouchedVersion("2.0.0", "2026.4.26")).toBe(false);
    expect(shouldWarnOnTouchedVersion("2026.4.26", "2.0.0")).toBe(true);
  });
});
