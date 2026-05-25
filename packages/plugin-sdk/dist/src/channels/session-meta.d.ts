import type { MsgContext } from "../auto-reply/templating.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function recordInboundSessionMetaSafe(params: {
    cfg: KovaConfig;
    agentId: string;
    sessionKey: string;
    ctx: MsgContext;
    onError?: (error: unknown) => void;
}): Promise<void>;
