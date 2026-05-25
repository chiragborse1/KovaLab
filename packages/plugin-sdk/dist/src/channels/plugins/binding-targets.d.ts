import type { KovaConfig } from "../../config/types.kova.js";
import type { ConfiguredBindingResolution } from "./binding-types.js";
export declare function ensureConfiguredBindingTargetReady(params: {
    cfg: KovaConfig;
    bindingResolution: ConfiguredBindingResolution | null;
}): Promise<{
    ok: true;
} | {
    ok: false;
    error: string;
}>;
export declare function resetConfiguredBindingTargetInPlace(params: {
    cfg: KovaConfig;
    sessionKey: string;
    reason: "new" | "reset";
    commandSource?: string;
}): Promise<{
    ok: true;
} | {
    ok: false;
    skipped?: boolean;
    error?: string;
}>;
export declare function ensureConfiguredBindingTargetSession(params: {
    cfg: KovaConfig;
    bindingResolution: ConfiguredBindingResolution;
}): Promise<{
    ok: true;
    sessionKey: string;
} | {
    ok: false;
    sessionKey: string;
    error: string;
}>;
