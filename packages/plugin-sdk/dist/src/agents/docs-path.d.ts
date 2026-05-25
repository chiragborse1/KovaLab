export declare const KOVA_DOCS_URL = "https://docs.neuralstudio.in";
export declare const KOVA_SOURCE_URL = "https://github.com/chiragborse1/KovaLab";
type ResolveKovaReferencePathParams = {
    workspaceDir?: string;
    argv1?: string;
    cwd?: string;
    moduleUrl?: string;
};
export declare function resolveKovaDocsPath(params: {
    workspaceDir?: string;
    argv1?: string;
    cwd?: string;
    moduleUrl?: string;
}): Promise<string | null>;
export declare function resolveKovaSourcePath(params: ResolveKovaReferencePathParams): Promise<string | null>;
export declare function resolveKovaReferencePaths(params: ResolveKovaReferencePathParams): Promise<{
    docsPath: string | null;
    sourcePath: string | null;
}>;
export {};
