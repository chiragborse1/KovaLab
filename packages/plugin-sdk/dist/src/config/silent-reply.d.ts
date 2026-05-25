import { type SilentReplyConversationType, type SilentReplyPolicy } from "../shared/silent-reply-policy.js";
import type { KovaConfig } from "./types.kova.js";
type ResolveSilentReplyParams = {
    cfg?: KovaConfig;
    sessionKey?: string;
    surface?: string;
    conversationType?: SilentReplyConversationType;
};
export declare function resolveSilentReplySettings(params: ResolveSilentReplyParams): {
    policy: SilentReplyPolicy;
    rewrite: boolean;
};
export declare function resolveSilentReplyPolicy(params: ResolveSilentReplyParams): SilentReplyPolicy;
export declare function resolveSilentReplyRewriteEnabled(params: ResolveSilentReplyParams): boolean;
export {};
