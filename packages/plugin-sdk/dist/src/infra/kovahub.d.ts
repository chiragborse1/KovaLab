export { parseKovaHubPluginSpec } from "./kovahub-spec.js";
export type KovaHubPackageFamily = "skill" | "code-plugin" | "bundle-plugin";
export type KovaHubPackageChannel = "official" | "community" | "private";
export type KovaHubPackageCompatibility = {
    pluginApiRange?: string;
    builtWithKovaVersion?: string;
    pluginSdkVersion?: string;
    minGatewayVersion?: string;
};
export type KovaHubPackageListItem = {
    name: string;
    displayName: string;
    family: KovaHubPackageFamily;
    runtimeId?: string | null;
    channel: KovaHubPackageChannel;
    isOfficial: boolean;
    summary?: string | null;
    ownerHandle?: string | null;
    createdAt: number;
    updatedAt: number;
    latestVersion?: string | null;
    capabilityTags?: string[];
    executesCode?: boolean;
    verificationTier?: string | null;
};
export type KovaHubPackageDetail = {
    package: (KovaHubPackageListItem & {
        tags?: Record<string, string>;
        compatibility?: KovaHubPackageCompatibility | null;
        capabilities?: {
            executesCode?: boolean;
            runtimeId?: string;
            capabilityTags?: string[];
            bundleFormat?: string;
            hostTargets?: string[];
            pluginKind?: string;
            channels?: string[];
            providers?: string[];
            hooks?: string[];
            bundledSkills?: string[];
        } | null;
        verification?: {
            tier?: string;
            scope?: string;
            summary?: string;
            sourceRepo?: string;
            sourceCommit?: string;
            hasProvenance?: boolean;
            scanStatus?: string;
        } | null;
    }) | null;
    owner?: {
        handle?: string | null;
        displayName?: string | null;
        image?: string | null;
    } | null;
};
export type KovaHubPackageVersion = {
    package: {
        name: string;
        displayName: string;
        family: KovaHubPackageFamily;
    } | null;
    version: {
        version: string;
        createdAt: number;
        changelog: string;
        distTags?: string[];
        files?: Array<{
            path: string;
            size: number;
            sha256: string;
            contentType?: string;
        }>;
        sha256hash?: string | null;
        compatibility?: KovaHubPackageCompatibility | null;
        capabilities?: KovaHubPackageDetail["package"] extends infer T ? T extends {
            capabilities?: infer C;
        } ? C : never : never;
        verification?: KovaHubPackageDetail["package"] extends infer T ? T extends {
            verification?: infer C;
        } ? C : never : never;
    } | null;
};
export type KovaHubPackageSearchResult = {
    score: number;
    package: KovaHubPackageListItem;
};
export type KovaHubSkillSearchResult = {
    score: number;
    slug: string;
    displayName: string;
    summary?: string;
    version?: string;
    updatedAt?: number;
};
export type KovaHubSkillDetail = {
    skill: {
        slug: string;
        displayName: string;
        summary?: string;
        tags?: Record<string, string>;
        createdAt: number;
        updatedAt: number;
    } | null;
    latestVersion?: {
        version: string;
        createdAt: number;
        changelog?: string;
    } | null;
    metadata?: {
        os?: string[] | null;
        systems?: string[] | null;
    } | null;
    owner?: {
        handle?: string | null;
        displayName?: string | null;
        image?: string | null;
    } | null;
};
export type KovaHubSkillListResponse = {
    items: Array<{
        slug: string;
        displayName: string;
        summary?: string;
        tags?: Record<string, string>;
        latestVersion?: {
            version: string;
            createdAt: number;
            changelog?: string;
        } | null;
        metadata?: {
            os?: string[] | null;
            systems?: string[] | null;
        } | null;
        createdAt: number;
        updatedAt: number;
    }>;
    nextCursor?: string | null;
};
export type KovaHubDownloadResult = {
    archivePath: string;
    integrity: string;
    cleanup: () => Promise<void>;
};
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export declare class KovaHubRequestError extends Error {
    readonly status: number;
    readonly requestPath: string;
    readonly responseBody: string;
    constructor(params: {
        path: string;
        status: number;
        body: string;
    });
}
export declare function resolveKovaHubAuthToken(): Promise<string | undefined>;
export declare function resolveKovaHubBaseUrl(baseUrl?: string): string;
export declare function formatSha256Integrity(bytes: Uint8Array): string;
export declare function normalizeKovaHubSha256Integrity(value: string): string | null;
export declare function normalizeKovaHubSha256Hex(value: string): string | null;
export declare function fetchKovaHubPackageDetail(params: {
    name: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
}): Promise<KovaHubPackageDetail>;
export declare function fetchKovaHubPackageVersion(params: {
    name: string;
    version: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
}): Promise<KovaHubPackageVersion>;
export declare function searchKovaHubPackages(params: {
    query: string;
    family?: KovaHubPackageFamily;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    limit?: number;
}): Promise<KovaHubPackageSearchResult[]>;
export declare function searchKovaHubSkills(params: {
    query: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    limit?: number;
}): Promise<KovaHubSkillSearchResult[]>;
export declare function fetchKovaHubSkillDetail(params: {
    slug: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
}): Promise<KovaHubSkillDetail>;
export declare function listKovaHubSkills(params: {
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
    limit?: number;
}): Promise<KovaHubSkillListResponse>;
export declare function downloadKovaHubPackageArchive(params: {
    name: string;
    version?: string;
    tag?: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
}): Promise<KovaHubDownloadResult>;
export declare function downloadKovaHubSkillArchive(params: {
    slug: string;
    version?: string;
    tag?: string;
    baseUrl?: string;
    token?: string;
    timeoutMs?: number;
    fetchImpl?: FetchLike;
}): Promise<KovaHubDownloadResult>;
export declare function resolveLatestVersionFromPackage(detail: KovaHubPackageDetail): string | null;
export declare function isKovaHubFamilySkill(detail: KovaHubPackageDetail | KovaHubSkillDetail): boolean;
export declare function satisfiesPluginApiRange(pluginApiVersion: string, pluginApiRange?: string | null): boolean;
export declare function satisfiesGatewayMinimum(currentVersion: string, minGatewayVersion?: string | null): boolean;
