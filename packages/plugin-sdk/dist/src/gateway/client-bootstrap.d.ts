import type { KovaConfig } from "../config/types.kova.js";
import type { ExplicitGatewayAuth } from "./credentials.js";
export declare function resolveGatewayUrlOverrideSource(urlSource: string): "cli" | "env" | undefined;
export declare function resolveGatewayClientBootstrap(params: {
    config: KovaConfig;
    gatewayUrl?: string;
    explicitAuth?: ExplicitGatewayAuth;
    env?: NodeJS.ProcessEnv;
}): Promise<{
    url: string;
    urlSource: string;
    auth: {
        token?: string;
        password?: string;
    };
}>;
