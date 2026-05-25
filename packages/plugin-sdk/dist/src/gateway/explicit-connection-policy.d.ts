import type { KovaConfig } from "../config/types.kova.js";
import { type ExplicitGatewayAuth } from "./credentials.js";
export declare function hasExplicitGatewayConnectionAuth(auth?: ExplicitGatewayAuth): boolean;
export declare function canSkipGatewayConfigLoad(params: {
    config?: KovaConfig;
    urlOverride?: string;
    explicitAuth?: ExplicitGatewayAuth;
}): boolean;
export declare function isGatewayConfigBypassCommandPath(commandPath: readonly string[]): boolean;
