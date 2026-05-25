export type NpmProjectInstallEnvOptions = {
    cacheDir?: string;
    npmConfigCwd?: string;
    npmConfigPrefix?: string | null;
};
type NpmFreshnessConfigScope = {
    npmConfigCwd?: string;
    npmConfigPrefix?: string | null;
};
export declare function createNpmFreshnessBypassArgs(env?: NodeJS.ProcessEnv, now?: Date, scope?: NpmFreshnessConfigScope): string[];
export declare function applyNpmFreshnessBypassEnv(env: NodeJS.ProcessEnv, now?: Date, scope?: NpmFreshnessConfigScope): void;
export declare function createNpmProjectInstallEnv(env: NodeJS.ProcessEnv, options?: NpmProjectInstallEnvOptions, now?: Date): NodeJS.ProcessEnv;
export {};
