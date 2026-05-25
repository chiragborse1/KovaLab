export declare function resolveKovaPackageRoot(opts: {
    cwd?: string;
    argv1?: string;
    moduleUrl?: string;
}): Promise<string | null>;
export declare function resolveKovaPackageRootSync(opts: {
    cwd?: string;
    argv1?: string;
    moduleUrl?: string;
}): string | null;
