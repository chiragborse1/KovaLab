import fs from "node:fs/promises";
import path from "node:path";
import {
  setImportedSourceEntry,
  shouldSkipImportedSourceWrite,
  type MemoryWikiImportedSourceGroup,
} from "./source-sync-state.js";

type ImportedSourceState = Parameters<typeof shouldSkipImportedSourceWrite>[0]["state"];

type FileStatLike = {
  isFile?: unknown;
  isSymbolicLink?: unknown;
  nlink?: unknown;
};

function isRegularFileStat(value: unknown): value is FileStatLike & { nlink: number } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const stat = value as FileStatLike;
  const isFile =
    typeof stat.isFile === "function"
      ? (stat.isFile as () => boolean).call(stat)
      : stat.isFile === true;
  return isFile && typeof stat.nlink === "number";
}

function isSymlinkStat(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  const stat = value as FileStatLike;
  return typeof stat.isSymbolicLink === "function"
    ? (stat.isSymbolicLink as () => boolean).call(stat)
    : stat.isSymbolicLink === true;
}

async function readImportedSourcePageStat(pageAbsPath: string) {
  try {
    return await fs.lstat(pageAbsPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      if (code === "ENOENT") {
        return null;
      }
    }
    throw error;
  }
}

export async function writeImportedSourcePage(params: {
  vaultRoot: string;
  syncKey: string;
  sourcePath: string;
  sourceUpdatedAtMs: number;
  sourceSize: number;
  renderFingerprint: string;
  pagePath: string;
  group: MemoryWikiImportedSourceGroup;
  state: ImportedSourceState;
  buildRendered: (raw: string, updatedAt: string) => string;
}): Promise<{ pagePath: string; changed: boolean; created: boolean }> {
  const pageAbsPath = path.join(params.vaultRoot, params.pagePath);
  const pageStat = await readImportedSourcePageStat(pageAbsPath);
  const created = !pageStat;
  const updatedAt = new Date(params.sourceUpdatedAtMs).toISOString();
  const shouldSkip = await shouldSkipImportedSourceWrite({
    vaultRoot: params.vaultRoot,
    syncKey: params.syncKey,
    expectedPagePath: params.pagePath,
    expectedSourcePath: params.sourcePath,
    sourceUpdatedAtMs: params.sourceUpdatedAtMs,
    sourceSize: params.sourceSize,
    renderFingerprint: params.renderFingerprint,
    state: params.state,
  });
  if (shouldSkip) {
    return { pagePath: params.pagePath, changed: false, created };
  }

  const raw = await fs.readFile(params.sourcePath, "utf8");
  const rendered = params.buildRendered(raw, updatedAt);
  const existing = pageStat?.isFile() ? await fs.readFile(pageAbsPath, "utf8").catch(() => "") : "";
  if (existing !== rendered) {
    if (isSymlinkStat(pageStat)) {
      throw new Error(`Refusing to write imported source page through symlink: ${params.pagePath}`);
    }
    if (pageStat && !pageStat.isFile()) {
      throw new Error(
        `Refusing to write imported source page (not-file): ${params.pagePath}: existing path is not a regular file`,
      );
    }
    if (isRegularFileStat(pageStat) && pageStat.nlink > 1) {
      await fs.rm(pageAbsPath);
    }
    await fs.writeFile(pageAbsPath, rendered, "utf8");
  }

  setImportedSourceEntry({
    syncKey: params.syncKey,
    state: params.state,
    entry: {
      group: params.group,
      pagePath: params.pagePath,
      sourcePath: params.sourcePath,
      sourceUpdatedAtMs: params.sourceUpdatedAtMs,
      sourceSize: params.sourceSize,
      renderFingerprint: params.renderFingerprint,
    },
  });
  return { pagePath: params.pagePath, changed: existing !== rendered, created };
}
