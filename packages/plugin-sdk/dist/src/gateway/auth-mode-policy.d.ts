import type { KovaConfig } from "../config/types.kova.js";
export declare const EXPLICIT_GATEWAY_AUTH_MODE_REQUIRED_ERROR = "Invalid config: gateway.auth.token and gateway.auth.password are both configured, but gateway.auth.mode is unset. Set gateway.auth.mode to token or password.";
export declare function hasAmbiguousGatewayAuthModeConfig(cfg: KovaConfig): boolean;
export declare function assertExplicitGatewayAuthModeWhenBothConfigured(cfg: KovaConfig): void;
