import type { MsgContext } from "../auto-reply/templating.js";
import type { KovaConfig } from "../config/types.js";
import type { ActiveMediaModel } from "./active-model.types.js";
import type { MediaAttachment, MediaUnderstandingProvider } from "./types.js";
export declare function runAudioTranscription(params: {
    ctx: MsgContext;
    cfg: KovaConfig;
    attachments?: MediaAttachment[];
    agentDir?: string;
    providers?: Record<string, MediaUnderstandingProvider>;
    activeModel?: ActiveMediaModel;
    localPathRoots?: readonly string[];
}): Promise<{
    transcript: string | undefined;
    attachments: MediaAttachment[];
}>;
