import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext, TemplateContext } from "../templating.js";
export declare function stageSandboxMedia(params: {
    ctx: MsgContext;
    sessionCtx: TemplateContext;
    cfg: KovaConfig;
    sessionKey?: string;
    workspaceDir: string;
}): Promise<void>;
