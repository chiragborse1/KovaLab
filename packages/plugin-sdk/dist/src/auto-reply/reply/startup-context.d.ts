import type { KovaConfig } from "../../config/config.js";
export declare function shouldApplyStartupContext(params: {
    cfg?: KovaConfig;
    action: "new" | "reset";
}): boolean;
export declare function buildSessionStartupContextPrelude(params: {
    workspaceDir: string;
    cfg?: KovaConfig;
    nowMs?: number;
}): Promise<string | null>;
