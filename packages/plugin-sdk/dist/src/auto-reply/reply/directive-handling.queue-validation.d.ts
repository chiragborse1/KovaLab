import type { SessionEntry } from "../../config/sessions.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { ReplyPayload } from "../types.js";
import type { InlineDirectives } from "./directive-handling.parse.js";
export declare function maybeHandleQueueDirective(params: {
    directives: InlineDirectives;
    cfg: KovaConfig;
    channel: string;
    sessionEntry?: SessionEntry;
}): ReplyPayload | undefined;
