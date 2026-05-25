import type { ReplyPayload } from "../../auto-reply/reply-payload.js";
import type { KovaConfig } from "../../config/types.kova.js";
export declare function shouldSuppressLocalExecApprovalPrompt(params: {
    channel?: string | null;
    cfg: KovaConfig;
    accountId?: string | null;
    payload: ReplyPayload;
}): boolean;
