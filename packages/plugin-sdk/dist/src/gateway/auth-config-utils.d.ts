import type { GatewayAuthConfig } from "../config/types.gateway.js";
import type { KovaConfig } from "../config/types.kova.js";
import { type SupportedGatewaySecretInputPath } from "./secret-input-paths.js";
export type GatewayAuthSecretInputPath = Extract<SupportedGatewaySecretInputPath, "gateway.auth.token" | "gateway.auth.password">;
export type GatewayAuthSecretRefResolutionParams = {
    cfg: KovaConfig;
    env: NodeJS.ProcessEnv;
    mode?: GatewayAuthConfig["mode"];
    hasPasswordCandidate: boolean;
    hasTokenCandidate: boolean;
};
export declare function hasConfiguredGatewayAuthSecretInput(cfg: KovaConfig, path: GatewayAuthSecretInputPath): boolean;
export declare function shouldResolveGatewayAuthSecretRef(params: {
    mode?: GatewayAuthConfig["mode"];
    path: GatewayAuthSecretInputPath;
    hasPasswordCandidate: boolean;
    hasTokenCandidate: boolean;
}): boolean;
export declare function shouldResolveGatewayTokenSecretRef(params: Omit<GatewayAuthSecretRefResolutionParams, "cfg" | "env">): boolean;
export declare function shouldResolveGatewayPasswordSecretRef(params: Omit<GatewayAuthSecretRefResolutionParams, "cfg" | "env">): boolean;
export declare function resolveGatewayAuthSecretRefValue(params: {
    cfg: KovaConfig;
    env: NodeJS.ProcessEnv;
    path: GatewayAuthSecretInputPath;
    shouldResolve: boolean;
}): Promise<string | undefined>;
export declare function resolveGatewayTokenSecretRefValue(params: GatewayAuthSecretRefResolutionParams): Promise<string | undefined>;
export declare function resolveGatewayPasswordSecretRefValue(params: GatewayAuthSecretRefResolutionParams): Promise<string | undefined>;
export declare function resolveGatewayAuthSecretRef(params: {
    cfg: KovaConfig;
    env: NodeJS.ProcessEnv;
    path: GatewayAuthSecretInputPath;
    shouldResolve: boolean;
}): Promise<KovaConfig>;
export declare function resolveGatewayPasswordSecretRef(params: {
    cfg: KovaConfig;
    env: NodeJS.ProcessEnv;
    mode?: GatewayAuthConfig["mode"];
    hasPasswordCandidate: boolean;
    hasTokenCandidate: boolean;
}): Promise<KovaConfig>;
export declare function materializeGatewayAuthSecretRefs(params: GatewayAuthSecretRefResolutionParams): Promise<KovaConfig>;
