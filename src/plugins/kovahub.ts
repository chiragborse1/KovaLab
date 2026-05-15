import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { formatCliCommand } from "../cli/command-format.js";
import {
  ARCHIVE_LIMIT_ERROR_CODE,
  ArchiveLimitError,
  DEFAULT_MAX_ARCHIVE_BYTES_ZIP,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_EXTRACTED_BYTES,
  DEFAULT_MAX_ENTRY_BYTES,
  loadZipArchiveWithPreflight,
} from "../infra/archive.js";
import { formatErrorMessage } from "../infra/errors.js";
import {
  KovaHubRequestError,
  downloadKovaHubPackageArchive,
  fetchKovaHubPackageDetail,
  fetchKovaHubPackageVersion,
  normalizeKovaHubSha256Integrity,
  normalizeKovaHubSha256Hex,
  parseKovaHubPluginSpec,
  resolveLatestVersionFromPackage,
  satisfiesGatewayMinimum,
  satisfiesPluginApiRange,
  type KovaHubPackageChannel,
  type KovaHubPackageCompatibility,
  type KovaHubPackageDetail,
  type KovaHubPackageFamily,
  type KovaHubPackageVersion,
} from "../infra/kovahub.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { resolveCompatibilityHostVersion } from "../version.js";
import type { InstallSafetyOverrides } from "./install-security-scan.js";
import { installPluginFromArchive, type InstallPluginResult } from "./install.js";

export const KOVAHUB_INSTALL_ERROR_CODE = {
  INVALID_SPEC: "invalid_spec",
  PACKAGE_NOT_FOUND: "package_not_found",
  VERSION_NOT_FOUND: "version_not_found",
  NO_INSTALLABLE_VERSION: "no_installable_version",
  SKILL_PACKAGE: "skill_package",
  UNSUPPORTED_FAMILY: "unsupported_family",
  PRIVATE_PACKAGE: "private_package",
  INCOMPATIBLE_PLUGIN_API: "incompatible_plugin_api",
  INCOMPATIBLE_GATEWAY: "incompatible_gateway",
  MISSING_ARCHIVE_INTEGRITY: "missing_archive_integrity",
  ARCHIVE_INTEGRITY_MISMATCH: "archive_integrity_mismatch",
} as const;

export type KovaHubInstallErrorCode =
  (typeof KOVAHUB_INSTALL_ERROR_CODE)[keyof typeof KOVAHUB_INSTALL_ERROR_CODE];

type PluginInstallLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

export type KovaHubPluginInstallRecordFields = {
  source: "kovahub";
  kovahubUrl: string;
  kovahubPackage: string;
  kovahubFamily: Exclude<KovaHubPackageFamily, "skill">;
  kovahubChannel?: KovaHubPackageChannel;
  version?: string;
  integrity?: string;
  resolvedAt?: string;
  installedAt?: string;
};

type KovaHubInstallFailure = {
  ok: false;
  error: string;
  code?: KovaHubInstallErrorCode;
};

type KovaHubFileEntryLike = {
  path?: unknown;
  sha256?: unknown;
};

type KovaHubFileVerificationEntry = {
  path: string;
  sha256: string;
};

type KovaHubArchiveVerification =
  | {
      kind: "archive-integrity";
      integrity: string;
    }
  | {
      kind: "file-list";
      files: KovaHubFileVerificationEntry[];
    };

type KovaHubArchiveVerificationResolution =
  | {
      ok: true;
      verification: KovaHubArchiveVerification | null;
    }
  | KovaHubInstallFailure;

type KovaHubArchiveFileVerificationResult =
  | {
      ok: true;
      validatedGeneratedPaths: string[];
    }
  | KovaHubInstallFailure;

type JSZipObjectWithSize = JSZip.JSZipObject & {
  // Internal JSZip field from loadAsync() metadata. Use it only as a best-effort
  // size hint; the streaming byte checks below are the authoritative guard.
  _data?: {
    uncompressedSize?: number;
  };
};

const KOVAHUB_GENERATED_ARCHIVE_METADATA_FILE = "_meta.json";

type KovaHubArchiveEntryLimits = {
  maxEntryBytes: number;
  addArchiveBytes: (bytes: number) => boolean;
};

export function formatKovaHubSpecifier(params: { name: string; version?: string }): string {
  return `kovahub:${params.name}${params.version ? `@${params.version}` : ""}`;
}

function buildKovaHubInstallFailure(
  error: string,
  code?: KovaHubInstallErrorCode,
): KovaHubInstallFailure {
  return { ok: false, error, code };
}

function isKovaHubInstallFailure(value: unknown): value is KovaHubInstallFailure {
  return Boolean(
    value &&
    typeof value === "object" &&
    "ok" in value &&
    Object.is((value as { ok?: unknown }).ok, false) &&
    "error" in value,
  );
}

function mapKovaHubRequestError(
  error: unknown,
  context: { stage: "package" | "version"; name: string; version?: string },
): KovaHubInstallFailure {
  if (error instanceof KovaHubRequestError && error.status === 404) {
    if (context.stage === "package") {
      return buildKovaHubInstallFailure(
        "Package not found on KovaHub.",
        KOVAHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
      );
    }
    return buildKovaHubInstallFailure(
      `Version not found on KovaHub: ${context.name}@${context.version ?? "unknown"}.`,
      KOVAHUB_INSTALL_ERROR_CODE.VERSION_NOT_FOUND,
    );
  }
  return buildKovaHubInstallFailure(formatErrorMessage(error));
}

function resolveRequestedVersion(params: {
  detail: KovaHubPackageDetail;
  requestedVersion?: string;
}): string | null {
  if (params.requestedVersion) {
    return params.requestedVersion;
  }
  return resolveLatestVersionFromPackage(params.detail);
}

function readTrimmedString(value: unknown): string | null {
  return normalizeOptionalString(value) ?? null;
}

function normalizeKovaHubRelativePath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  if (value.trim() !== value || value.includes("\\")) {
    return null;
  }
  if (value.startsWith("/")) {
    return null;
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return null;
  }
  return value;
}

function describeInvalidKovaHubRelativePath(value: unknown): string {
  if (typeof value !== "string") {
    return `non-string value of type ${typeof value}`;
  }
  if (value.length === 0) {
    return "empty string";
  }
  if (value.trim() !== value) {
    return `path "${value}" has leading or trailing whitespace`;
  }
  if (value.includes("\\")) {
    return `path "${value}" contains backslashes`;
  }
  if (value.startsWith("/")) {
    return `path "${value}" is absolute`;
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    return `path "${value}" contains an empty segment`;
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return `path "${value}" contains dot segments`;
  }
  return `path "${value}" failed validation for an unknown reason`;
}

function describeInvalidKovaHubSha256(value: unknown): string {
  if (typeof value !== "string") {
    return `non-string value of type ${typeof value}`;
  }
  if (value.length === 0) {
    return "empty string";
  }
  if (value.trim().length === 0) {
    return "whitespace-only string";
  }
  return `value "${value}" is not a 64-character hexadecimal SHA-256 digest`;
}

function resolveKovaHubArchiveVerification(
  versionDetail: KovaHubPackageVersion,
  packageName: string,
  version: string,
): KovaHubArchiveVerificationResolution {
  const sha256hashValue = versionDetail.version?.sha256hash;
  const sha256hash = readTrimmedString(sha256hashValue);
  const integrity = sha256hash ? normalizeKovaHubSha256Integrity(sha256hash) : null;
  if (integrity) {
    return {
      ok: true,
      verification: {
        kind: "archive-integrity",
        integrity,
      },
    };
  }
  if (sha256hashValue !== undefined && sha256hashValue !== null) {
    const detail =
      typeof sha256hashValue === "string" && sha256hashValue.trim().length === 0
        ? "empty string"
        : typeof sha256hashValue === "string"
          ? `unrecognized value "${sha256hashValue.trim()}"`
          : `non-string value of type ${typeof sha256hashValue}`;
    return buildKovaHubInstallFailure(
      `KovaHub version metadata for "${packageName}@${version}" has an invalid sha256hash (${detail}).`,
      KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
    );
  }
  const files = versionDetail.version?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return {
      ok: true,
      verification: null,
    };
  }
  const normalizedFiles: KovaHubFileVerificationEntry[] = [];
  const seenPaths = new Set<string>();
  for (const [index, file] of files.entries()) {
    if (!file || typeof file !== "object") {
      return buildKovaHubInstallFailure(
        `KovaHub version metadata for "${packageName}@${version}" has an invalid files[${index}] entry (expected an object, got ${file === null ? "null" : typeof file}).`,
        KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    const fileRecord = file as KovaHubFileEntryLike;
    const filePath = normalizeKovaHubRelativePath(fileRecord.path);
    const sha256Value = readTrimmedString(fileRecord.sha256);
    const sha256 = sha256Value ? normalizeKovaHubSha256Hex(sha256Value) : null;
    if (!filePath) {
      return buildKovaHubInstallFailure(
        `KovaHub version metadata for "${packageName}@${version}" has an invalid files[${index}].path (${describeInvalidKovaHubRelativePath(fileRecord.path)}).`,
        KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    if (filePath === KOVAHUB_GENERATED_ARCHIVE_METADATA_FILE) {
      return buildKovaHubInstallFailure(
        `KovaHub version metadata for "${packageName}@${version}" must not include generated file "${filePath}" in files[].`,
        KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    if (!sha256) {
      return buildKovaHubInstallFailure(
        `KovaHub version metadata for "${packageName}@${version}" has an invalid files[${index}].sha256 (${describeInvalidKovaHubSha256(fileRecord.sha256)}).`,
        KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    if (seenPaths.has(filePath)) {
      return buildKovaHubInstallFailure(
        `KovaHub version metadata for "${packageName}@${version}" has duplicate files[] path "${filePath}".`,
        KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
      );
    }
    seenPaths.add(filePath);
    normalizedFiles.push({ path: filePath, sha256 });
  }
  return {
    ok: true,
    verification: {
      kind: "file-list",
      files: normalizedFiles,
    },
  };
}

async function readLimitedKovaHubArchiveEntry<T>(
  entry: JSZip.JSZipObject,
  limits: KovaHubArchiveEntryLimits,
  handlers: {
    onChunk: (buffer: Buffer) => void;
    onEnd: () => T;
  },
): Promise<T | KovaHubInstallFailure> {
  const hintedSize = (entry as JSZipObjectWithSize)._data?.uncompressedSize;
  if (
    typeof hintedSize === "number" &&
    Number.isFinite(hintedSize) &&
    hintedSize > limits.maxEntryBytes
  ) {
    return buildKovaHubInstallFailure(
      `KovaHub archive fallback verification rejected "${entry.name}" because it exceeds the per-file size limit.`,
      KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  let entryBytes = 0;
  return await new Promise<T | KovaHubInstallFailure>((resolve) => {
    let settled = false;
    const stream = entry.nodeStream("nodebuffer") as NodeJS.ReadableStream & {
      destroy?: (error?: Error) => void;
    };
    stream.on("data", (chunk: Buffer | Uint8Array | string) => {
      if (settled) {
        return;
      }
      const buffer =
        typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array);
      entryBytes += buffer.byteLength;
      if (entryBytes > limits.maxEntryBytes) {
        settled = true;
        stream.destroy?.();
        resolve(
          buildKovaHubInstallFailure(
            `KovaHub archive fallback verification rejected "${entry.name}" because it exceeds the per-file size limit.`,
            KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
          ),
        );
        return;
      }
      if (!limits.addArchiveBytes(buffer.byteLength)) {
        settled = true;
        stream.destroy?.();
        resolve(
          buildKovaHubInstallFailure(
            "KovaHub archive fallback verification exceeded the total extracted-size limit.",
            KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
          ),
        );
        return;
      }
      handlers.onChunk(buffer);
    });
    stream.once("end", () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(handlers.onEnd());
    });
    stream.once("error", (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(
        buildKovaHubInstallFailure(
          error instanceof Error ? error.message : String(error),
          KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        ),
      );
    });
  });
}

async function readKovaHubArchiveEntryBuffer(
  entry: JSZip.JSZipObject,
  limits: KovaHubArchiveEntryLimits,
): Promise<Buffer | KovaHubInstallFailure> {
  const chunks: Buffer[] = [];
  return await readLimitedKovaHubArchiveEntry(entry, limits, {
    onChunk(buffer) {
      chunks.push(buffer);
    },
    onEnd() {
      return Buffer.concat(chunks);
    },
  });
}

async function hashKovaHubArchiveEntry(
  entry: JSZip.JSZipObject,
  limits: KovaHubArchiveEntryLimits,
): Promise<string | KovaHubInstallFailure> {
  const digest = createHash("sha256");
  return await readLimitedKovaHubArchiveEntry(entry, limits, {
    onChunk(buffer) {
      digest.update(buffer);
    },
    onEnd() {
      return digest.digest("hex");
    },
  });
}

function validateKovaHubArchiveMetaJson(params: {
  packageName: string;
  version: string;
  bytes: Buffer;
}): KovaHubInstallFailure | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params.bytes.toString("utf8"));
  } catch {
    return buildKovaHubInstallFailure(
      `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json is not valid JSON.`,
      KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    return buildKovaHubInstallFailure(
      `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json is not a JSON object.`,
      KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  const record = parsed as { slug?: unknown; version?: unknown };
  if (record.slug !== params.packageName) {
    return buildKovaHubInstallFailure(
      `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json slug does not match the package name.`,
      KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  if (record.version !== params.version) {
    return buildKovaHubInstallFailure(
      `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.version}": _meta.json version does not match the package version.`,
      KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
    );
  }
  return null;
}

function mapKovaHubArchiveReadFailure(error: unknown): KovaHubInstallFailure {
  if (error instanceof ArchiveLimitError) {
    if (error.code === ARCHIVE_LIMIT_ERROR_CODE.ENTRY_COUNT_EXCEEDS_LIMIT) {
      return buildKovaHubInstallFailure(
        "KovaHub archive fallback verification exceeded the archive entry limit.",
        KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
    if (error.code === ARCHIVE_LIMIT_ERROR_CODE.ARCHIVE_SIZE_EXCEEDS_LIMIT) {
      return buildKovaHubInstallFailure(
        "KovaHub archive fallback verification rejected the downloaded archive because it exceeds the ZIP archive size limit.",
        KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
  }
  return buildKovaHubInstallFailure(
    "KovaHub archive fallback verification failed while reading the downloaded archive.",
    KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
  );
}

async function verifyKovaHubArchiveFiles(params: {
  archivePath: string;
  packageName: string;
  packageVersion: string;
  files: KovaHubFileVerificationEntry[];
}): Promise<KovaHubArchiveFileVerificationResult> {
  try {
    const archiveStat = await fs.stat(params.archivePath);
    if (archiveStat.size > DEFAULT_MAX_ARCHIVE_BYTES_ZIP) {
      return buildKovaHubInstallFailure(
        "KovaHub archive fallback verification rejected the downloaded archive because it exceeds the ZIP archive size limit.",
        KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
    const archiveBytes = await fs.readFile(params.archivePath);
    const zip = await loadZipArchiveWithPreflight(archiveBytes, {
      maxArchiveBytes: DEFAULT_MAX_ARCHIVE_BYTES_ZIP,
      maxEntries: DEFAULT_MAX_ENTRIES,
      maxExtractedBytes: DEFAULT_MAX_EXTRACTED_BYTES,
      maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
    });
    const actualFiles = new Map<string, string>();
    const validatedGeneratedPaths = new Set<string>();
    let entryCount = 0;
    let extractedBytes = 0;
    const addArchiveBytes = (bytes: number): boolean => {
      extractedBytes += bytes;
      return extractedBytes <= DEFAULT_MAX_EXTRACTED_BYTES;
    };
    for (const entry of Object.values(zip.files)) {
      entryCount += 1;
      if (entryCount > DEFAULT_MAX_ENTRIES) {
        return buildKovaHubInstallFailure(
          "KovaHub archive fallback verification exceeded the archive entry limit.",
          KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (entry.dir) {
        continue;
      }
      const relativePath = normalizeKovaHubRelativePath(entry.name);
      if (!relativePath) {
        return buildKovaHubInstallFailure(
          `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": invalid package file path "${entry.name}" (${describeInvalidKovaHubRelativePath(entry.name)}).`,
          KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (relativePath === KOVAHUB_GENERATED_ARCHIVE_METADATA_FILE) {
        const metaResult = await readKovaHubArchiveEntryBuffer(entry, {
          maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
          addArchiveBytes,
        });
        if (isKovaHubInstallFailure(metaResult)) {
          return metaResult;
        }
        const metaFailure = validateKovaHubArchiveMetaJson({
          packageName: params.packageName,
          version: params.packageVersion,
          bytes: metaResult,
        });
        if (metaFailure) {
          return metaFailure;
        }
        validatedGeneratedPaths.add(relativePath);
        continue;
      }
      const sha256 = await hashKovaHubArchiveEntry(entry, {
        maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES,
        addArchiveBytes,
      });
      if (typeof sha256 !== "string") {
        return sha256;
      }
      actualFiles.set(relativePath, sha256);
    }
    for (const file of params.files) {
      const actualSha256 = actualFiles.get(file.path);
      if (!actualSha256) {
        return buildKovaHubInstallFailure(
          `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": missing "${file.path}".`,
          KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      if (actualSha256 !== file.sha256) {
        return buildKovaHubInstallFailure(
          `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": expected ${file.path} to hash to ${file.sha256}, got ${actualSha256}.`,
          KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
      actualFiles.delete(file.path);
    }
    const unexpectedFile = [...actualFiles.keys()].toSorted()[0];
    if (unexpectedFile) {
      return buildKovaHubInstallFailure(
        `KovaHub archive contents do not match files[] metadata for "${params.packageName}@${params.packageVersion}": unexpected file "${unexpectedFile}".`,
        KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
      );
    }
    return {
      ok: true,
      validatedGeneratedPaths: [...validatedGeneratedPaths].toSorted(),
    };
  } catch (error) {
    return mapKovaHubArchiveReadFailure(error);
  }
}

async function resolveCompatiblePackageVersion(params: {
  detail: KovaHubPackageDetail;
  requestedVersion?: string;
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
}): Promise<
  | {
      ok: true;
      version: string;
      compatibility?: KovaHubPackageCompatibility | null;
      verification: KovaHubArchiveVerification | null;
    }
  | KovaHubInstallFailure
> {
  const requestedVersion = resolveRequestedVersion(params);
  if (!requestedVersion) {
    return buildKovaHubInstallFailure(
      `KovaHub package "${params.detail.package?.name ?? "unknown"}" has no installable version.`,
      KOVAHUB_INSTALL_ERROR_CODE.NO_INSTALLABLE_VERSION,
    );
  }
  let versionDetail;
  try {
    versionDetail = await fetchKovaHubPackageVersion({
      name: params.detail.package?.name ?? "",
      version: requestedVersion,
      baseUrl: params.baseUrl,
      token: params.token,
      timeoutMs: params.timeoutMs,
    });
  } catch (error) {
    return mapKovaHubRequestError(error, {
      stage: "version",
      name: params.detail.package?.name ?? "unknown",
      version: requestedVersion,
    });
  }
  const resolvedVersion = versionDetail.version?.version ?? requestedVersion;
  if (params.detail.package?.family === "skill") {
    return {
      ok: true,
      version: resolvedVersion,
      compatibility:
        versionDetail.version?.compatibility ?? params.detail.package?.compatibility ?? null,
      verification: null,
    };
  }
  const verificationState = resolveKovaHubArchiveVerification(
    versionDetail,
    params.detail.package?.name ?? "unknown",
    resolvedVersion,
  );
  if (!verificationState.ok) {
    return verificationState;
  }
  return {
    ok: true,
    version: resolvedVersion,
    compatibility:
      versionDetail.version?.compatibility ?? params.detail.package?.compatibility ?? null,
    verification: verificationState.verification,
  };
}

function validateKovaHubPluginPackage(params: {
  detail: KovaHubPackageDetail;
  compatibility?: KovaHubPackageCompatibility | null;
  runtimeVersion: string;
}): KovaHubInstallFailure | null {
  const pkg = params.detail.package;
  if (!pkg) {
    return buildKovaHubInstallFailure(
      "Package not found on KovaHub.",
      KOVAHUB_INSTALL_ERROR_CODE.PACKAGE_NOT_FOUND,
    );
  }
  if (pkg.family === "skill") {
    return buildKovaHubInstallFailure(
      `"${pkg.name}" is a skill. Use "${formatCliCommand(`kova skills install ${pkg.name}`)}" instead.`,
      KOVAHUB_INSTALL_ERROR_CODE.SKILL_PACKAGE,
    );
  }
  if (pkg.family !== "code-plugin" && pkg.family !== "bundle-plugin") {
    return buildKovaHubInstallFailure(
      `Unsupported KovaHub package family: ${String(pkg.family)}`,
      KOVAHUB_INSTALL_ERROR_CODE.UNSUPPORTED_FAMILY,
    );
  }
  if (pkg.channel === "private") {
    return buildKovaHubInstallFailure(
      `"${pkg.name}" is private on KovaHub and cannot be installed anonymously.`,
      KOVAHUB_INSTALL_ERROR_CODE.PRIVATE_PACKAGE,
    );
  }

  const compatibility = params.compatibility;
  const runtimeVersion = params.runtimeVersion;
  if (
    compatibility?.pluginApiRange &&
    !satisfiesPluginApiRange(runtimeVersion, compatibility.pluginApiRange)
  ) {
    return buildKovaHubInstallFailure(
      `Plugin "${pkg.name}" requires plugin API ${compatibility.pluginApiRange}, but this Kova runtime exposes ${runtimeVersion}.`,
      KOVAHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_PLUGIN_API,
    );
  }

  if (
    compatibility?.minGatewayVersion &&
    !satisfiesGatewayMinimum(runtimeVersion, compatibility.minGatewayVersion)
  ) {
    return buildKovaHubInstallFailure(
      `Plugin "${pkg.name}" requires Kova >=${compatibility.minGatewayVersion}, but this host is ${runtimeVersion}.`,
      KOVAHUB_INSTALL_ERROR_CODE.INCOMPATIBLE_GATEWAY,
    );
  }
  return null;
}

function logKovaHubPackageSummary(params: {
  detail: KovaHubPackageDetail;
  version: string;
  compatibility?: KovaHubPackageCompatibility | null;
  logger?: PluginInstallLogger;
}) {
  const pkg = params.detail.package;
  if (!pkg) {
    return;
  }
  const verification = pkg.verification?.tier ? ` verification=${pkg.verification.tier}` : "";
  params.logger?.info?.(
    `KovaHub ${pkg.family} ${pkg.name}@${params.version} channel=${pkg.channel}${verification}`,
  );
  const compatibilityParts = [
    params.compatibility?.pluginApiRange
      ? `pluginApi=${params.compatibility.pluginApiRange}`
      : null,
    params.compatibility?.minGatewayVersion
      ? `minGateway=${params.compatibility.minGatewayVersion}`
      : null,
  ].filter(Boolean);
  if (compatibilityParts.length > 0) {
    params.logger?.info?.(`Compatibility: ${compatibilityParts.join(" ")}`);
  }
  if (pkg.channel !== "official") {
    params.logger?.warn?.(
      `KovaHub package "${pkg.name}" is ${pkg.channel}; review source and verification before enabling.`,
    );
  }
}

export async function installPluginFromKovaHub(
  params: InstallSafetyOverrides & {
    spec: string;
    baseUrl?: string;
    token?: string;
    logger?: PluginInstallLogger;
    mode?: "install" | "update";
    extensionsDir?: string;
    timeoutMs?: number;
    dryRun?: boolean;
    expectedPluginId?: string;
  },
): Promise<
  | ({
      ok: true;
    } & Extract<InstallPluginResult, { ok: true }> & {
        kovahub: KovaHubPluginInstallRecordFields;
        packageName: string;
      })
  | KovaHubInstallFailure
  | Extract<InstallPluginResult, { ok: false }>
> {
  const parsed = parseKovaHubPluginSpec(params.spec);
  if (!parsed?.name) {
    return buildKovaHubInstallFailure(
      `invalid KovaHub plugin spec: ${params.spec}`,
      KOVAHUB_INSTALL_ERROR_CODE.INVALID_SPEC,
    );
  }

  params.logger?.info?.(`Resolving ${formatKovaHubSpecifier(parsed)}…`);
  let detail: KovaHubPackageDetail;
  try {
    detail = await fetchKovaHubPackageDetail({
      name: parsed.name,
      baseUrl: params.baseUrl,
      token: params.token,
      timeoutMs: params.timeoutMs,
    });
  } catch (error) {
    return mapKovaHubRequestError(error, {
      stage: "package",
      name: parsed.name,
    });
  }
  const versionState = await resolveCompatiblePackageVersion({
    detail,
    requestedVersion: parsed.version,
    baseUrl: params.baseUrl,
    token: params.token,
    timeoutMs: params.timeoutMs,
  });
  if (!versionState.ok) {
    return versionState;
  }
  const runtimeVersion = resolveCompatibilityHostVersion();
  const validationFailure = validateKovaHubPluginPackage({
    detail,
    compatibility: versionState.compatibility,
    runtimeVersion,
  });
  if (validationFailure) {
    return validationFailure;
  }
  if (!versionState.verification) {
    return buildKovaHubInstallFailure(
      `KovaHub version metadata for "${parsed.name}@${versionState.version}" is missing sha256hash and usable files[] metadata for fallback archive verification.`,
      KOVAHUB_INSTALL_ERROR_CODE.MISSING_ARCHIVE_INTEGRITY,
    );
  }
  const canonicalPackageName = detail.package?.name ?? parsed.name;
  logKovaHubPackageSummary({
    detail,
    version: versionState.version,
    compatibility: versionState.compatibility,
    logger: params.logger,
  });

  let archive;
  try {
    archive = await downloadKovaHubPackageArchive({
      name: parsed.name,
      version: versionState.version,
      baseUrl: params.baseUrl,
      token: params.token,
      timeoutMs: params.timeoutMs,
    });
  } catch (error) {
    return buildKovaHubInstallFailure(formatErrorMessage(error));
  }
  try {
    if (versionState.verification.kind === "archive-integrity") {
      if (archive.integrity !== versionState.verification.integrity) {
        return buildKovaHubInstallFailure(
          `KovaHub archive integrity mismatch for "${parsed.name}@${versionState.version}": expected ${versionState.verification.integrity}, got ${archive.integrity}.`,
          KOVAHUB_INSTALL_ERROR_CODE.ARCHIVE_INTEGRITY_MISMATCH,
        );
      }
    } else {
      const validatedPaths = versionState.verification.files
        .map((file) => file.path)
        .toSorted()
        .join(", ");
      const fallbackVerification = await verifyKovaHubArchiveFiles({
        archivePath: archive.archivePath,
        packageName: canonicalPackageName,
        packageVersion: versionState.version,
        files: versionState.verification.files,
      });
      if (!fallbackVerification.ok) {
        return fallbackVerification;
      }
      const validatedGeneratedPaths =
        fallbackVerification.validatedGeneratedPaths.length > 0
          ? ` Validated generated metadata files present in archive: ${fallbackVerification.validatedGeneratedPaths.join(", ")} (JSON parse plus slug/version match only).`
          : "";
      params.logger?.warn?.(
        `KovaHub package "${canonicalPackageName}@${versionState.version}" is missing sha256hash; falling back to files[] verification. Validated files: ${validatedPaths}.${validatedGeneratedPaths}`,
      );
    }
    params.logger?.info?.(
      `Downloading ${detail.package?.family === "bundle-plugin" ? "bundle" : "plugin"} ${parsed.name}@${versionState.version} from KovaHub…`,
    );
    const installResult = await installPluginFromArchive({
      archivePath: archive.archivePath,
      dangerouslyForceUnsafeInstall: params.dangerouslyForceUnsafeInstall,
      logger: params.logger,
      mode: params.mode,
      extensionsDir: params.extensionsDir,
      timeoutMs: params.timeoutMs,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId,
    });
    if (!installResult.ok) {
      return installResult;
    }

    const pkg = detail.package!;
    const kovahubFamily =
      pkg.family === "code-plugin" || pkg.family === "bundle-plugin" ? pkg.family : null;
    if (!kovahubFamily) {
      return buildKovaHubInstallFailure(
        `Unsupported KovaHub package family: ${pkg.family}`,
        KOVAHUB_INSTALL_ERROR_CODE.UNSUPPORTED_FAMILY,
      );
    }
    return {
      ...installResult,
      packageName: parsed.name,
      kovahub: {
        source: "kovahub",
        kovahubUrl:
          normalizeOptionalString(params.baseUrl) ||
          normalizeOptionalString(process.env.KOVA_KOVAHUB_URL) ||
          "https://kovahub.ai",
        kovahubPackage: parsed.name,
        kovahubFamily,
        kovahubChannel: pkg.channel,
        version: installResult.version ?? versionState.version,
        // For fallback installs this is the observed download digest, not a
        // server-attested sha256hash from KovaHub version metadata.
        integrity: archive.integrity,
        resolvedAt: new Date().toISOString(),
      },
    };
  } finally {
    await archive.cleanup().catch(() => undefined);
  }
}
