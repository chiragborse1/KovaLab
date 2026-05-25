import type { KovaConfig } from "../../config/types.kova.js";
import type { SandboxConfig, SandboxToolPolicyResolved } from "./types.js";
export declare function resolveSandboxRuntimeStatus(params: {
    cfg?: KovaConfig;
    sessionKey?: string;
}): {
    agentId: string;
    sessionKey: string;
    mainSessionKey: string;
    mode: SandboxConfig["mode"];
    sandboxed: boolean;
    toolPolicy: SandboxToolPolicyResolved;
};
export declare function formatSandboxToolPolicyBlockedMessage(params: {
    cfg?: KovaConfig;
    sessionKey?: string;
    toolName: string;
}): string | undefined;
