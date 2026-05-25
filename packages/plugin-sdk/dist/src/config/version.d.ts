export type KovaVersion = {
    major: number;
    minor: number;
    patch: number;
    revision: number | null;
    prerelease: string[] | null;
};
export declare function parseKovaVersion(raw: string | null | undefined): KovaVersion | null;
export declare function normalizeKovaVersionBase(raw: string | null | undefined): string | null;
export declare function isSameKovaStableFamily(a: string | null | undefined, b: string | null | undefined): boolean;
export declare function compareKovaVersions(a: string | null | undefined, b: string | null | undefined): number | null;
export declare function shouldWarnOnTouchedVersion(current: string | null | undefined, touched: string | null | undefined): boolean;
