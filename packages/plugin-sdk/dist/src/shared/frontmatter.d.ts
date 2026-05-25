export declare function normalizeStringList(input: unknown): string[];
export declare function getFrontmatterString(frontmatter: Record<string, unknown>, key: string): string | undefined;
export declare function parseFrontmatterBool(value: string | undefined, fallback: boolean): boolean;
export declare function resolveKovaManifestBlock(params: {
    frontmatter: Record<string, unknown>;
    key?: string;
}): Record<string, unknown> | undefined;
export type KovaManifestRequires = {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
};
export declare function resolveKovaManifestRequires(metadataObj: Record<string, unknown>): KovaManifestRequires | undefined;
export declare function resolveKovaManifestInstall<T>(metadataObj: Record<string, unknown>, parseInstallSpec: (input: unknown) => T | undefined): T[];
export declare function resolveKovaManifestOs(metadataObj: Record<string, unknown>): string[];
export type ParsedKovaManifestInstallBase = {
    raw: Record<string, unknown>;
    kind: string;
    id?: string;
    label?: string;
    bins?: string[];
};
export declare function parseKovaManifestInstallBase(input: unknown, allowedKinds: readonly string[]): ParsedKovaManifestInstallBase | undefined;
export declare function applyKovaManifestInstallCommonFields<T extends {
    id?: string;
    label?: string;
    bins?: string[];
}>(spec: T, parsed: Pick<ParsedKovaManifestInstallBase, "id" | "label" | "bins">): T;
