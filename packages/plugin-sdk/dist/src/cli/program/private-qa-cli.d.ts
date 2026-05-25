import fs from "node:fs";
import { resolveKovaPackageRootSync } from "../../infra/kova-root.js";
export declare function isPrivateQaCliEnabled(env?: NodeJS.ProcessEnv): boolean;
export declare function loadPrivateQaCliModule(params?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    argv1?: string;
    moduleUrl?: string;
    resolvePackageRootSync?: typeof resolveKovaPackageRootSync;
    existsSync?: typeof fs.existsSync;
    importModule?: (specifier: string) => Promise<Record<string, unknown>>;
}): Promise<Record<string, unknown>>;
