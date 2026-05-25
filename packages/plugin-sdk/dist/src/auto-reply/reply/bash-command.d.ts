import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
import type { ReplyPayload } from "../types.js";
export declare function handleBashChatCommand(params: {
    ctx: MsgContext;
    cfg: KovaConfig;
    agentId?: string;
    sessionKey: string;
    isGroup: boolean;
    elevated: {
        enabled: boolean;
        allowed: boolean;
        failures: Array<{
            gate: string;
            key: string;
        }>;
    };
}): Promise<ReplyPayload>;
export declare function resetBashChatCommandForTests(): void;
