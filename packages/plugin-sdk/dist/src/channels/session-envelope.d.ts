import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveInboundSessionEnvelopeContext(params: {
    cfg: KovaConfig;
    agentId: string;
    sessionKey: string;
}): {
    storePath: string;
    envelopeOptions: import("../auto-reply/envelope.js").EnvelopeFormatOptions;
    previousTimestamp: number | undefined;
};
