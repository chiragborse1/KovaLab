import type { KovaConfig } from "../../config/types.kova.js";
import type { FinalizedMsgContext } from "../templating.js";
export declare function emitPreAgentMessageHooks(params: {
    ctx: FinalizedMsgContext;
    cfg: KovaConfig;
    isFastTestEnv: boolean;
}): void;
