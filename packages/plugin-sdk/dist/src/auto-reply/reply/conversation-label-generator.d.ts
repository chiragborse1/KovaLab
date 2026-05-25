import type { KovaConfig } from "../../config/types.kova.js";
export type ConversationLabelParams = {
    userMessage: string;
    prompt: string;
    cfg: KovaConfig;
    agentId?: string;
    agentDir?: string;
    maxLength?: number;
};
export declare function generateConversationLabel(params: ConversationLabelParams): Promise<string | null>;
