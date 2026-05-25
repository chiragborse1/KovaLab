import type { MsgContext } from "../auto-reply/templating.js";
import type { KovaConfig } from "../config/types.kova.js";
export type LinkUnderstandingResult = {
    urls: string[];
    outputs: string[];
};
export declare function runLinkUnderstanding(params: {
    cfg: KovaConfig;
    ctx: MsgContext;
    message?: string;
}): Promise<LinkUnderstandingResult>;
