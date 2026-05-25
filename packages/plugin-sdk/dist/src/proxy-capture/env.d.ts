import type { Agent } from "node:http";
export declare const KOVA_DEBUG_PROXY_ENABLED = "KOVA_DEBUG_PROXY_ENABLED";
export declare const KOVA_DEBUG_PROXY_URL = "KOVA_DEBUG_PROXY_URL";
export declare const KOVA_DEBUG_PROXY_DB_PATH = "KOVA_DEBUG_PROXY_DB_PATH";
export declare const KOVA_DEBUG_PROXY_BLOB_DIR = "KOVA_DEBUG_PROXY_BLOB_DIR";
export declare const KOVA_DEBUG_PROXY_CERT_DIR = "KOVA_DEBUG_PROXY_CERT_DIR";
export declare const KOVA_DEBUG_PROXY_SESSION_ID = "KOVA_DEBUG_PROXY_SESSION_ID";
export declare const KOVA_DEBUG_PROXY_REQUIRE = "KOVA_DEBUG_PROXY_REQUIRE";
export type DebugProxySettings = {
    enabled: boolean;
    required: boolean;
    proxyUrl?: string;
    dbPath: string;
    blobDir: string;
    certDir: string;
    sessionId: string;
    sourceProcess: string;
};
export declare function resolveDebugProxySettings(env?: NodeJS.ProcessEnv): DebugProxySettings;
export declare function applyDebugProxyEnv(env: NodeJS.ProcessEnv, params: {
    proxyUrl: string;
    sessionId: string;
    dbPath?: string;
    blobDir?: string;
    certDir?: string;
}): NodeJS.ProcessEnv;
export declare function createDebugProxyWebSocketAgent(settings: DebugProxySettings): Agent | undefined;
export declare function resolveEffectiveDebugProxyUrl(configuredProxyUrl?: string): string | undefined;
