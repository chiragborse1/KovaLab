import type { GetReplyOptions } from "../auto-reply/get-reply-options.types.js";
import { type ResponsePrefixContext } from "../auto-reply/reply/response-prefix-template.js";
import type { KovaConfig } from "../config/types.kova.js";
type ModelSelectionContext = Parameters<NonNullable<GetReplyOptions["onModelSelected"]>>[0];
export type ReplyPrefixContextBundle = {
    prefixContext: ResponsePrefixContext;
    responsePrefix?: string;
    responsePrefixContextProvider: () => ResponsePrefixContext;
    onModelSelected: (ctx: ModelSelectionContext) => void;
};
export type ReplyPrefixOptions = Pick<ReplyPrefixContextBundle, "responsePrefix" | "responsePrefixContextProvider" | "onModelSelected">;
export declare function createReplyPrefixContext(params: {
    cfg: KovaConfig;
    agentId: string;
    channel?: string;
    accountId?: string;
}): ReplyPrefixContextBundle;
export declare function createReplyPrefixOptions(params: {
    cfg: KovaConfig;
    agentId: string;
    channel?: string;
    accountId?: string;
}): ReplyPrefixOptions;
export {};
