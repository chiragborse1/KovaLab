import type { GroupKeyResolution, SessionEntry } from "../../config/sessions.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { SilentReplyPolicy } from "../../shared/silent-reply-policy.js";
import type { TemplateContext } from "../templating.js";
export declare function resolveGroupRequireMention(params: {
    cfg: KovaConfig;
    ctx: TemplateContext;
    groupResolution?: GroupKeyResolution;
}): Promise<boolean>;
export declare function defaultGroupActivation(requireMention: boolean): "always" | "mention";
export declare function buildGroupChatContext(params: {
    sessionCtx: TemplateContext;
}): string;
export declare function buildDirectChatContext(params: {
    sessionCtx: TemplateContext;
    silentReplyPolicy?: SilentReplyPolicy;
    silentReplyRewrite?: boolean;
    silentToken: string;
}): string;
export declare function resolveGroupSilentReplyBehavior(params: {
    sessionEntry?: SessionEntry;
    defaultActivation: "always" | "mention";
    silentReplyPolicy?: SilentReplyPolicy;
    silentReplyRewrite?: boolean;
}): {
    activation: "always" | "mention";
    canUseSilentReply: boolean;
    allowEmptyAssistantReplyAsSilent: boolean;
};
export declare function buildGroupIntro(params: {
    cfg: KovaConfig;
    sessionCtx: TemplateContext;
    sessionEntry?: SessionEntry;
    defaultActivation: "always" | "mention";
    silentToken: string;
    silentReplyPolicy?: SilentReplyPolicy;
    silentReplyRewrite?: boolean;
}): string;
