import type { MarkdownTableMode } from "./types.base.js";
import type { KovaConfig } from "./types.kova.js";
export type ResolveMarkdownTableModeParams = {
    cfg?: Partial<KovaConfig>;
    channel?: string | null;
    accountId?: string | null;
};
export type ResolveMarkdownTableMode = (params: ResolveMarkdownTableModeParams) => MarkdownTableMode;
