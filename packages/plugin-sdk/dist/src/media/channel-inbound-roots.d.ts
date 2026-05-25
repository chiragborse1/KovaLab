import type { MsgContext } from "../auto-reply/templating.js";
import type { KovaConfig } from "../config/types.js";
export declare function resolveChannelInboundAttachmentRoots(params: {
    cfg: KovaConfig;
    ctx: MsgContext;
}): readonly string[] | undefined;
export declare function resolveChannelRemoteInboundAttachmentRoots(params: {
    cfg: KovaConfig;
    ctx: MsgContext;
}): readonly string[] | undefined;
