import type { Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type RegularFileStatResult = { missing: true } | { missing: false; stat: Stats };

export function isFileMissingError(
  err: unknown,
): err is NodeJS.ErrnoException & { code: "ENOENT" | "ENOTDIR" | "not-found" } {
  return Boolean(
    err &&
    typeof err === "object" &&
    "code" in err &&
    ((err as Partial<NodeJS.ErrnoException>).code === "ENOENT" ||
      (err as Partial<NodeJS.ErrnoException>).code === "ENOTDIR" ||
      (err as { code?: unknown }).code === "not-found"),
  );
}

export function isPathInside(basePath: string, candidatePath: string): boolean {
  const base = path.resolve(basePath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(base, candidate);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}

async function safeRealpath(filePath: string): Promise<string | null> {
  try {
    return await fs.realpath(filePath);
  } catch {
    return null;
  }
}

export async function isPathInsideWithRealpath(
  basePath: string,
  candidatePath: string,
): Promise<boolean> {
  if (!isPathInside(basePath, candidatePath)) {
    return false;
  }
  const baseReal = await safeRealpath(basePath);
  const candidateReal = await safeRealpath(candidatePath);
  if (!baseReal || !candidateReal) {
    return false;
  }
  return isPathInside(baseReal, candidateReal);
}

export async function assertNoSymlinkParents(params: {
  rootDir: string;
  targetPath: string;
}): Promise<void> {
  const rootDir = path.resolve(params.rootDir);
  const targetDir = path.resolve(path.dirname(params.targetPath));
  if (!isPathInside(rootDir, targetDir)) {
    throw new Error("path required");
  }
  const relParts = path.relative(rootDir, targetDir).split(path.sep).filter(Boolean);
  let current = rootDir;
  for (const part of relParts) {
    current = path.join(current, part);
    let stat: Stats;
    try {
      stat = await fs.lstat(current);
    } catch (err) {
      if (isFileMissingError(err)) {
        return;
      }
      throw err;
    }
    if (stat.isSymbolicLink()) {
      throw new Error("path required");
    }
    if (!stat.isDirectory()) {
      return;
    }
  }
}

export async function statRegularFile(absPath: string): Promise<RegularFileStatResult> {
  let stat: Stats;
  try {
    stat = await fs.lstat(absPath);
  } catch (err) {
    if (isFileMissingError(err)) {
      return { missing: true };
    }
    throw err;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("path required");
  }
  return { missing: false, stat };
}
