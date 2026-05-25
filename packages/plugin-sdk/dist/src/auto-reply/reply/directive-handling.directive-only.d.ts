import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
import type { InlineDirectives } from "./directive-handling.parse.js";
export declare function isDirectiveOnly(params: {
    directives: InlineDirectives;
    cleanedBody: string;
    ctx: MsgContext;
    cfg: KovaConfig;
    agentId?: string;
    isGroup: boolean;
}): boolean;
