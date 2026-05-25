import type { SessionAcpMeta } from "../../config/sessions/types.js";
import type { KovaConfig } from "../../config/types.kova.js";
export declare function persistAcpDispatchTranscript(params: {
    cfg: KovaConfig;
    sessionKey: string;
    promptText: string;
    finalText: string;
    meta?: SessionAcpMeta;
    threadId?: string | number;
}): Promise<void>;
