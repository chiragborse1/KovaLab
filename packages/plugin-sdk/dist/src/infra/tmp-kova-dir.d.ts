export declare const POSIX_KOVA_TMP_DIR = "/tmp/kova";
type ResolvePreferredKovaTmpDirOptions = {
    accessSync?: (path: string, mode?: number) => void;
    chmodSync?: (path: string, mode: number) => void;
    lstatSync?: (path: string) => {
        isDirectory(): boolean;
        isSymbolicLink(): boolean;
        mode?: number;
        uid?: number;
    };
    mkdirSync?: (path: string, opts: {
        recursive: boolean;
        mode?: number;
    }) => void;
    getuid?: () => number | undefined;
    tmpdir?: () => string;
    warn?: (message: string) => void;
};
export declare function resolvePreferredKovaTmpDir(options?: ResolvePreferredKovaTmpDirOptions): string;
export {};
