import fs from "node:fs";
import path from "node:path";

export type AssertNoSymlinkParentsOptions = {
  rootDir: string;
  targetPath: string;
  allowOutsideRoot?: boolean;
  messagePrefix?: string;
};

export function assertNoSymlinkParentsSync(opts: AssertNoSymlinkParentsOptions): void {
  const resolvedRoot = path.resolve(opts.rootDir);
  const resolvedTarget = path.resolve(opts.targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (opts.allowOutsideRoot !== true && (relative.startsWith("..") || path.isAbsolute(relative))) {
    throw new Error(`${opts.messagePrefix ?? "Refusing unsafe path"}: ${resolvedTarget}`);
  }

  const segments = relative && relative !== "." ? relative.split(path.sep) : [];
  let current = resolvedRoot;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new Error(`${opts.messagePrefix ?? "Refusing to traverse symlink"}: ${current}`);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }
}
