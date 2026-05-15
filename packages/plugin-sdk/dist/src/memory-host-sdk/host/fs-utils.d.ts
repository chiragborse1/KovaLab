import type { Stats } from "node:fs";
export type RegularFileStatResult = {
    missing: true;
} | {
    missing: false;
    stat: Stats;
};
export declare function isFileMissingError(err: unknown): err is NodeJS.ErrnoException & {
    code: "ENOENT" | "ENOTDIR" | "not-found";
};
export declare function isPathInside(basePath: string, candidatePath: string): boolean;
export declare function isPathInsideWithRealpath(basePath: string, candidatePath: string): Promise<boolean>;
export declare function assertNoSymlinkParents(params: {
    rootDir: string;
    targetPath: string;
}): Promise<void>;
export declare function statRegularFile(absPath: string): Promise<RegularFileStatResult>;
