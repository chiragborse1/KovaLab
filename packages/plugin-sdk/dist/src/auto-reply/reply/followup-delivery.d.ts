import type { MessagingToolSend } from "../../agents/pi-embedded-messaging.types.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { ReplyPayload } from "../types.js";
export declare function resolveFollowupDeliveryPayloads(params: {
    cfg: KovaConfig;
    payloads: ReplyPayload[];
    messageProvider?: string;
    originatingAccountId?: string;
    originatingChannel?: string;
    originatingChatType?: string | null;
    originatingTo?: string;
    sentMediaUrls?: string[];
    sentTargets?: MessagingToolSend[];
    sentTexts?: string[];
}): ReplyPayload[];
