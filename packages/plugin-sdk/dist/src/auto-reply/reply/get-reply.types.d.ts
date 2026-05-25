import type { KovaConfig } from "../../config/types.kova.js";
import type { GetReplyOptions } from "../get-reply-options.types.js";
import type { ReplyPayload } from "../reply-payload.js";
import type { MsgContext } from "../templating.js";
export type GetReplyFromConfig = (ctx: MsgContext, opts?: GetReplyOptions, configOverride?: KovaConfig) => Promise<ReplyPayload | ReplyPayload[] | undefined>;
