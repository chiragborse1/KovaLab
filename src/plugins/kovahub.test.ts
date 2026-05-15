import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parseKovaHubPluginSpecMock = vi.fn();
const fetchKovaHubPackageDetailMock = vi.fn();
const fetchKovaHubPackageVersionMock = vi.fn();
const downloadKovaHubPackageArchiveMock = vi.fn();
const archiveCleanupMock = vi.fn();
const resolveLatestVersionFromPackageMock = vi.fn();
const resolveCompatibilityHostVersionMock = vi.fn();
const installPluginFromArchiveMock = vi.fn();

vi.mock("../infra/kovahub.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/kovahub.js")>("../infra/kovahub.js");
  return {
    ...actual,
    parseKovaHubPluginSpec: (...args: unknown[]) => parseKovaHubPluginSpecMock(...args),
    fetchKovaHubPackageDetail: (...args: unknown[]) => fetchKovaHubPackageDetailMock(...args),
    fetchKovaHubPackageVersion: (...args: unknown[]) => fetchKovaHubPackageVersionMock(...args),
    downloadKovaHubPackageArchive: (...args: unknown[]) =>
      downloadKovaHubPackageArchiveMock(...args),
    resolveLatestVersionFromPackage: (...args: unknown[]) =>
      resolveLatestVersionFromPackageMock(...args),
  };
});

vi.mock("../version.js", () => ({
  resolveCompatibilityHostVersion: (...args: unknown[]) =>
    resolveCompatibilityHostVersionMock(...args),
}));

vi.mock("./install.js", () => ({
  installPluginFromArchive: (...args: unknown[]) => installPluginFromArchiveMock(...args),
}));

vi.mock("../infra/archive.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/archive.js")>("../infra/archive.js");
  return {
    ...actual,
    DEFAULT_MAX_ENTRIES: 50_000,
    DEFAULT_MAX_EXTRACTED_BYTES: 512 * 1024 * 1024,
    DEFAULT_MAX_ENTRY_BYTES: 256 * 1024 * 1024,
  };
});

const { KovaHubRequestError } = await import("../infra/kovahub.js");
const { KOVAHUB_INSTALL_ERROR_CODE, formatKovaHubSpecifier, installPluginFromKovaHub } =
  await import("./kovahub.js");

const DEMO_ARCHIVE_INTEGRITY = "sha256-qerEjGEpvES2+Tyan0j2xwDRkbcnmh4ZFfKN9vWbsa8=";
const tempDirs: string[] = [];

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function createKovaHubArchive(entries: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
  tempDirs.push(dir);
  const archivePath = path.join(dir, "archive.zip");
  const zip = new JSZip();
  for (const [filePath, contents] of Object.entries(entries)) {
    zip.file(filePath, contents);
  }
  const archiveBytes = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(archivePath, archiveBytes);
  return {
    archivePath,
    integrity: `sha256-${createHash("sha256").update(archiveBytes).digest("base64")}`,
  };
}

async function expectKovaHubInstallError(params: {
  setup?: () => void;
  spec: string;
  expected: {
    ok: false;
    code: (typeof KOVAHUB_INSTALL_ERROR_CODE)[keyof typeof KOVAHUB_INSTALL_ERROR_CODE];
    error: string;
  };
}) {
  params.setup?.();
  await expect(installPluginFromKovaHub({ spec: params.spec })).resolves.toMatchObject(
    params.expected,
  );
}

function createLoggerSpies() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
  };
}

function createZipCentralDirectoryArchive(params: {
  actualEntryCount: number;
  declaredEntryCount?: number;
  declaredCentralDirectorySize?: number;
}): Buffer {
  const centralDirectory = Buffer.concat(
    Array.from({ length: params.actualEntryCount }, (_, index) => {
      const name = Buffer.from(`file-${index}.txt`);
      const header = Buffer.alloc(46 + name.byteLength);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(name.byteLength, 28);
      name.copy(header, 46);
      return header;
    }),
  );
  const declaredEntryCount = params.declaredEntryCount ?? params.actualEntryCount;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Math.min(declaredEntryCount, 0xffff), 8);
  eocd.writeUInt16LE(Math.min(declaredEntryCount, 0xffff), 10);
  eocd.writeUInt32LE(params.declaredCentralDirectorySize ?? centralDirectory.byteLength, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([centralDirectory, eocd]);
}

function expectKovaHubInstallFlow(params: {
  baseUrl: string;
  version: string;
  archivePath: string;
}) {
  expect(fetchKovaHubPackageDetailMock).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "demo",
      baseUrl: params.baseUrl,
    }),
  );
  expect(fetchKovaHubPackageVersionMock).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "demo",
      version: params.version,
    }),
  );
  expect(installPluginFromArchiveMock).toHaveBeenCalledWith(
    expect.objectContaining({
      archivePath: params.archivePath,
    }),
  );
}

function expectSuccessfulKovaHubInstall(result: unknown) {
  expect(result).toMatchObject({
    ok: true,
    pluginId: "demo",
    version: "2026.3.22",
    kovahub: {
      source: "kovahub",
      kovahubPackage: "demo",
      kovahubFamily: "code-plugin",
      kovahubChannel: "official",
      integrity: DEMO_ARCHIVE_INTEGRITY,
    },
  });
}

describe("installPluginFromKovaHub", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  beforeEach(() => {
    parseKovaHubPluginSpecMock.mockReset();
    fetchKovaHubPackageDetailMock.mockReset();
    fetchKovaHubPackageVersionMock.mockReset();
    downloadKovaHubPackageArchiveMock.mockReset();
    archiveCleanupMock.mockReset();
    resolveLatestVersionFromPackageMock.mockReset();
    resolveCompatibilityHostVersionMock.mockReset();
    installPluginFromArchiveMock.mockReset();

    parseKovaHubPluginSpecMock.mockReturnValue({ name: "demo" });
    fetchKovaHubPackageDetailMock.mockResolvedValue({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    resolveLatestVersionFromPackageMock.mockReturnValue("2026.3.22");
    fetchKovaHubPackageVersionMock.mockResolvedValue({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValue({
      archivePath: "/tmp/kovahub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });
    archiveCleanupMock.mockResolvedValue(undefined);
    resolveCompatibilityHostVersionMock.mockReturnValue("2026.3.22");
    installPluginFromArchiveMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/kova/plugins/demo",
      version: "2026.3.22",
    });
  });

  it("formats kovahub specifiers", () => {
    expect(formatKovaHubSpecifier({ name: "demo" })).toBe("kovahub:demo");
    expect(formatKovaHubSpecifier({ name: "demo", version: "1.2.3" })).toBe("kovahub:demo@1.2.3");
  });

  it("installs a KovaHub code plugin through the archive installer", async () => {
    const logger = createLoggerSpies();
    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
      baseUrl: "https://kovahub.ai",
      logger,
    });

    expectKovaHubInstallFlow({
      baseUrl: "https://kovahub.ai",
      version: "2026.3.22",
      archivePath: "/tmp/kovahub-demo/archive.zip",
    });
    expectSuccessfulKovaHubInstall(result);
    expect(logger.info).toHaveBeenCalledWith("KovaHub code-plugin demo@2026.3.22 channel=official");
    expect(logger.info).toHaveBeenCalledWith(
      "Compatibility: pluginApi=>=2026.3.22 minGateway=2026.3.0",
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("installs when KovaHub advertises a wildcard plugin API range", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: "*",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
      baseUrl: "https://kovahub.ai",
    });

    expectSuccessfulKovaHubInstall(result);
    expect(downloadKovaHubPackageArchiveMock).toHaveBeenCalledTimes(1);
    expect(installPluginFromArchiveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        archivePath: "/tmp/kovahub-demo/archive.zip",
      }),
    );
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("does not let a wildcard plugin API range hide an invalid runtime version", async () => {
    resolveCompatibilityHostVersionMock.mockReturnValueOnce("invalid");
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: "*",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
      error: 'Plugin "demo" requires plugin API *, but this Kova runtime exposes invalid.',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
    expect(archiveCleanupMock).not.toHaveBeenCalled();
  });

  it("passes dangerous force unsafe install through to archive installs", async () => {
    await installPluginFromKovaHub({
      spec: "kovahub:demo",
      dangerouslyForceUnsafeInstall: true,
    });

    expect(installPluginFromArchiveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        archivePath: "/tmp/kovahub-demo/archive.zip",
        dangerouslyForceUnsafeInstall: true,
      }),
    );
  });

  it("cleans up the downloaded archive even when archive install fails", async () => {
    installPluginFromArchiveMock.mockResolvedValueOnce({
      ok: false,
      error: "bad archive",
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
      baseUrl: "https://kovahub.ai",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "bad archive",
    });
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("accepts version-endpoint SHA-256 hashes expressed as raw hex", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "a9eac48c6129bc44b6f93c9a9f48f6c700d191b7279a1e1915f28df6f59bb1af",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/kovahub-demo/archive.zip",
      integrity: "sha256-qerEjGEpvES2+Tyan0j2xwDRkbcnmh4ZFfKN9vWbsa8=",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({ ok: true, pluginId: "demo" });
  });

  it("accepts version-endpoint SHA-256 hashes expressed as unpadded SRI", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "sha256-qerEjGEpvES2+Tyan0j2xwDRkbcnmh4ZFfKN9vWbsa8",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/kovahub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({ ok: true, pluginId: "demo" });
  });

  it("falls back to strict files[] verification when sha256hash is missing", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
      "dist/index.js": 'export const demo = "ok";',
      "_meta.json": '{"slug":"demo","version":"2026.3.22"}',
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: null,
        files: [
          {
            path: "dist/index.js",
            size: 25,
            sha256: sha256Hex('export const demo = "ok";'),
          },
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
      logger,
    });

    expect(result).toMatchObject({ ok: true, pluginId: "demo" });
    expect(logger.warn).toHaveBeenCalledWith(
      'KovaHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: dist/index.js, kova.plugin.json. Validated generated metadata files present in archive: _meta.json (JSON parse plus slug/version match only).',
    );
  });

  it("validates _meta.json against canonical package and resolved version metadata", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
      "_meta.json": '{"slug":"demo","version":"2026.3.22"}',
    });
    parseKovaHubPluginSpecMock.mockReturnValueOnce({ name: "DemoAlias", version: "latest" });
    fetchKovaHubPackageDetailMock.mockResolvedValueOnce({
      package: {
        name: "demo",
        displayName: "Demo",
        family: "code-plugin",
        channel: "official",
        isOfficial: true,
        createdAt: 0,
        updatedAt: 0,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: null,
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromKovaHub({
      spec: "kovahub:DemoAlias@latest",
      logger,
    });

    expect(result).toMatchObject({ ok: true, pluginId: "demo", version: "2026.3.22" });
    expect(fetchKovaHubPackageDetailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "DemoAlias",
      }),
    );
    expect(fetchKovaHubPackageVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "demo",
        version: "latest",
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'KovaHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: kova.plugin.json. Validated generated metadata files present in archive: _meta.json (JSON parse plus slug/version match only).',
    );
  });

  it("fails closed when sha256hash is present but unrecognized instead of silently falling back", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "definitely-not-a-sha256",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has an invalid sha256hash (unrecognized value "definitely-not-a-sha256").',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects KovaHub installs when sha256hash is explicitly null and files[] is unavailable", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: null,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" is missing sha256hash and usable files[] metadata for fallback archive verification.',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects KovaHub installs when the version metadata has no archive hash or fallback files[]", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" is missing sha256hash and usable files[] metadata for fallback archive verification.',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("fails closed when files[] contains a malformed entry", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [null as unknown as { path: string; sha256: string }],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has an invalid files[0] entry (expected an object, got null).',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("fails closed when files[] contains an invalid sha256", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: "not-a-digest",
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has an invalid files[0].sha256 (value "not-a-digest" is not a 64-character hexadecimal SHA-256 digest).',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("fails closed when sha256hash is not a string", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: 123 as unknown as string,
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has an invalid sha256hash (non-string value of type number).',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("returns a typed install failure when the archive download throws", async () => {
    downloadKovaHubPackageArchiveMock.mockRejectedValueOnce(new Error("network timeout"));

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "network timeout",
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("returns a typed install failure when fallback archive verification cannot read the zip", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "not-a-zip", "utf8");
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error: "KovaHub archive fallback verification failed while reading the downloaded archive.",
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects KovaHub installs when the downloaded archive hash drifts from metadata", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        sha256hash: "1111111111111111111111111111111111111111111111111111111111111111",
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath: "/tmp/kovahub-demo/archive.zip",
      integrity: DEMO_ARCHIVE_INTEGRITY,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error: `KovaHub archive integrity mismatch for "demo@2026.3.22": expected sha256-ERERERERERERERERERERERERERERERERERERERERERE=, got ${DEMO_ARCHIVE_INTEGRITY}.`,
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
    expect(archiveCleanupMock).toHaveBeenCalledTimes(1);
  });

  it("rejects fallback verification when an expected file is missing from the archive", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
          {
            path: "dist/index.js",
            size: 25,
            sha256: sha256Hex('export const demo = "ok";'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        'KovaHub archive contents do not match files[] metadata for "demo@2026.3.22": missing "dist/index.js".',
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the archive includes an unexpected file", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
      "dist/index.js": 'export const demo = "ok";',
      "extra.txt": "surprise",
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
          {
            path: "dist/index.js",
            size: 25,
            sha256: sha256Hex('export const demo = "ok";'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        'KovaHub archive contents do not match files[] metadata for "demo@2026.3.22": unexpected file "extra.txt".',
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("accepts root-level files[] paths and allows _meta.json as an unvalidated generated file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    const zip = new JSZip();
    zip.file("scripts/search.py", "print('ok')\n");
    zip.file("SKILL.md", "# Demo\n");
    zip.file("_meta.json", '{"slug":"demo","version":"2026.3.22"}');
    const archiveBytes = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(archivePath, archiveBytes);
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "scripts/search.py",
            size: 12,
            sha256: sha256Hex("print('ok')\n"),
          },
          {
            path: "SKILL.md",
            size: 7,
            sha256: sha256Hex("# Demo\n"),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: `sha256-${createHash("sha256").update(archiveBytes).digest("base64")}`,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
      logger,
    });

    expect(result).toMatchObject({ ok: true, pluginId: "demo" });
    expect(logger.warn).toHaveBeenCalledWith(
      'KovaHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: SKILL.md, scripts/search.py. Validated generated metadata files present in archive: _meta.json (JSON parse plus slug/version match only).',
    );
  });

  it("omits the skipped-files suffix when no generated extras are present", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });
    const logger = createLoggerSpies();

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
      logger,
    });

    expect(result).toMatchObject({ ok: true, pluginId: "demo" });
    expect(logger.warn).toHaveBeenCalledWith(
      'KovaHub package "demo@2026.3.22" is missing sha256hash; falling back to files[] verification. Validated files: kova.plugin.json.',
    );
  });

  it("rejects fallback verification when _meta.json is not valid JSON", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
      "_meta.json": "{not-json",
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        'KovaHub archive contents do not match files[] metadata for "demo@2026.3.22": _meta.json is not valid JSON.',
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when _meta.json slug does not match the package name", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
      "_meta.json": '{"slug":"wrong","version":"2026.3.22"}',
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        'KovaHub archive contents do not match files[] metadata for "demo@2026.3.22": _meta.json slug does not match the package name.',
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when _meta.json exceeds the per-file size limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "placeholder", "utf8");
    const oversizedMetaEntry = {
      name: "_meta.json",
      dir: false,
      _data: { uncompressedSize: 256 * 1024 * 1024 + 1 },
      nodeStream: vi.fn(),
    } as unknown as JSZip.JSZipObject;
    const listedFileEntry = {
      name: "kova.plugin.json",
      dir: false,
      _data: { uncompressedSize: 13 },
      nodeStream: () => Readable.from([Buffer.from('{"id":"demo"}')]),
    } as unknown as JSZip.JSZipObject;
    const loadAsyncSpy = vi.spyOn(JSZip, "loadAsync").mockResolvedValueOnce({
      files: {
        "_meta.json": oversizedMetaEntry,
        "kova.plugin.json": listedFileEntry,
      },
    } as unknown as JSZip);
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    loadAsyncSpy.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        'KovaHub archive fallback verification rejected "_meta.json" because it exceeds the per-file size limit.',
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when archive directories alone exceed the entry limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "placeholder", "utf8");
    const zipEntries = Object.fromEntries(
      Array.from({ length: 50_001 }, (_, index) => [
        `folder-${index}/`,
        {
          name: `folder-${index}/`,
          dir: true,
        },
      ]),
    );
    const loadAsyncSpy = vi.spyOn(JSZip, "loadAsync").mockResolvedValueOnce({
      files: zipEntries,
    } as unknown as JSZip);
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    loadAsyncSpy.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error: "KovaHub archive fallback verification exceeded the archive entry limit.",
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the actual ZIP central directory exceeds the entry limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(
      archivePath,
      createZipCentralDirectoryArchive({
        actualEntryCount: 50_001,
        declaredEntryCount: 1,
        declaredCentralDirectorySize: 0,
      }),
    );
    const loadAsyncSpy = vi.spyOn(JSZip, "loadAsync");
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    loadAsyncSpy.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error: "KovaHub archive fallback verification exceeded the archive entry limit.",
    });
    expect(loadAsyncSpy).not.toHaveBeenCalled();
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the downloaded archive exceeds the ZIP size limit", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-kovahub-archive-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "archive.zip");
    await fs.writeFile(archivePath, "placeholder", "utf8");
    const realStat = fs.stat.bind(fs);
    const statSpy = vi.spyOn(fs, "stat").mockImplementation(async (filePath, options) => {
      if (filePath === archivePath) {
        return {
          size: 256 * 1024 * 1024 + 1,
        } as Awaited<ReturnType<typeof fs.stat>>;
      }
      return await realStat(filePath, options);
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      archivePath,
      integrity: "sha256-not-used-in-fallback",
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    statSpy.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        "KovaHub archive fallback verification rejected the downloaded archive because it exceeds the ZIP archive size limit.",
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when a file hash drifts from files[] metadata", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: "1".repeat(64),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error: `KovaHub archive contents do not match files[] metadata for "demo@2026.3.22": expected kova.plugin.json to hash to ${"1".repeat(64)}, got ${sha256Hex('{"id":"demo"}')}.`,
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata with an unsafe files[] path", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "../evil.txt",
            size: 4,
            sha256: "1".repeat(64),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has an invalid files[0].path (path "../evil.txt" contains dot segments).',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata with leading or trailing path whitespace", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json ",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has an invalid files[0].path (path "kova.plugin.json " has leading or trailing whitespace).',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback verification when the archive includes a whitespace-suffixed file path", async () => {
    const archive = await createKovaHubArchive({
      "kova.plugin.json": '{"id":"demo"}',
      "kova.plugin.json ": '{"id":"demo"}',
    });
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });
    downloadKovaHubPackageArchiveMock.mockResolvedValueOnce({
      ...archive,
      cleanup: archiveCleanupMock,
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      error:
        'KovaHub archive contents do not match files[] metadata for "demo@2026.3.22": invalid package file path "kova.plugin.json " (path "kova.plugin.json " has leading or trailing whitespace).',
    });
    expect(installPluginFromArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata with duplicate files[] paths", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
          {
            path: "kova.plugin.json",
            size: 13,
            sha256: sha256Hex('{"id":"demo"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" has duplicate files[] path "kova.plugin.json".',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it("rejects fallback metadata when files[] includes generated _meta.json", async () => {
    fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
      version: {
        version: "2026.3.22",
        createdAt: 0,
        changelog: "",
        files: [
          {
            path: "_meta.json",
            size: 64,
            sha256: sha256Hex('{"slug":"demo","version":"2026.3.22"}'),
          },
        ],
        compatibility: {
          pluginApiRange: ">=2026.3.22",
          minGatewayVersion: "2026.3.0",
        },
      },
    });

    const result = await installPluginFromKovaHub({
      spec: "kovahub:demo",
    });

    expect(result).toMatchObject({
      ok: false,
      code: KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      error:
        'KovaHub version metadata for "demo@2026.3.22" must not include generated file "_meta.json" in files[].',
    });
    expect(downloadKovaHubPackageArchiveMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "rejects packages whose plugin API range exceeds the runtime version",
      setup: () => {
        resolveCompatibilityHostVersionMock.mockReturnValueOnce("2026.3.21");
      },
      spec: "kovahub:demo",
      expected: {
        ok: false,
        code: KOVAHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
        error:
          'Plugin "demo" requires plugin API >=2026.3.22, but this Kova runtime exposes 2026.3.21.',
      },
    },
    {
      name: "rejects skill families and redirects to skills install",
      setup: () => {
        fetchKovaHubPackageDetailMock.mockResolvedValueOnce({
          package: {
            name: "calendar",
            displayName: "Calendar",
            family: "skill",
            channel: "official",
            isOfficial: true,
            createdAt: 0,
            updatedAt: 0,
          },
        });
      },
      spec: "kovahub:calendar",
      expected: {
        ok: false,
        code: KOVAHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
        error: '"calendar" is a skill. Use "kova skills install calendar" instead.',
      },
    },
    {
      name: "redirects skill families before missing archive metadata checks",
      setup: () => {
        fetchKovaHubPackageDetailMock.mockResolvedValueOnce({
          package: {
            name: "calendar",
            displayName: "Calendar",
            family: "skill",
            channel: "official",
            isOfficial: true,
            createdAt: 0,
            updatedAt: 0,
          },
        });
        fetchKovaHubPackageVersionMock.mockResolvedValueOnce({
          version: {
            version: "2026.3.22",
            createdAt: 0,
            changelog: "",
          },
        });
      },
      spec: "kovahub:calendar",
      expected: {
        ok: false,
        code: KOVAHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
        error: '"calendar" is a skill. Use "kova skills install calendar" instead.',
      },
    },
    {
      name: "returns typed package-not-found failures",
      setup: () => {
        fetchKovaHubPackageDetailMock.mockRejectedValueOnce(
          new KovaHubRequestError({
            path: "/api/v1/packages/demo",
            status: 404,
            body: "Package not found",
          }),
        );
      },
      spec: "kovahub:demo",
      expected: {
        ok: false,
        code: KOVAHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
        error: "Package not found on KovaHub.",
      },
    },
    {
      name: "returns typed version-not-found failures",
      setup: () => {
        parseKovaHubPluginSpecMock.mockReturnValueOnce({ name: "demo", version: "9.9.9" });
        fetchKovaHubPackageVersionMock.mockRejectedValueOnce(
          new KovaHubRequestError({
            path: "/api/v1/packages/demo/versions/9.9.9",
            status: 404,
            body: "Version not found",
          }),
        );
      },
      spec: "kovahub:demo@9.9.9",
      expected: {
        ok: false,
        code: KOVAHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND,
        error: "Version not found on KovaHub: demo@9.9.9.",
      },
    },
  ] as const)("$name", async ({ setup, spec, expected }) => {
    await expectKovaHubInstallError({ setup, spec, expected });
  });
});
