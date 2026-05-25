import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
export declare function isResetAuthorizedForContext(params: {
    ctx: MsgContext;
    cfg: KovaConfig;
    commandAuthorized: boolean;
}): boolean;
