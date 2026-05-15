import type { OpenClawConfig } from "../config/types.js";
export type GatewayConnectionDetails = {
    url: string;
    urlSource: string;
    bindDetail?: string;
    remoteFallbackNote?: string;
    message: string;
};
type GatewayConnectionDetailResolvers = {
    getRuntimeConfig?: () => OpenClawConfig;
    resolveConfigPath?: (env: NodeJS.ProcessEnv) => string;
    resolveGatewayPort?: (cfg?: OpenClawConfig, env?: NodeJS.ProcessEnv) => number;
};
export declare function readGatewayUrlEnv(env?: NodeJS.ProcessEnv): {
    url: string;
    source: "KOVA_GATEWAY_URL" | "OPENCLAW_GATEWAY_URL";
} | undefined;
export declare function resolveAllowInsecurePrivateWs(env?: NodeJS.ProcessEnv): boolean;
export declare function buildGatewayConnectionDetailsWithResolvers(options?: {
    config?: OpenClawConfig;
    url?: string;
    configPath?: string;
    urlSource?: "cli" | "env";
}, resolvers?: GatewayConnectionDetailResolvers): GatewayConnectionDetails;
export {};
