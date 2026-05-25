import type { MsgContext } from "../auto-reply/templating.js";
import type { KovaConfig } from "../config/types.kova.js";
export type ApplyLinkUnderstandingResult = {
    outputs: string[];
    urls: string[];
};
export declare function applyLinkUnderstanding(params: {
    ctx: MsgContext;
    cfg: KovaConfig;
}): Promise<ApplyLinkUnderstandingResult>;
