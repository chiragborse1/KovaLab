import type { KovaConfig } from "./config.js";
export declare function resolveChannelCapabilities(params: {
    cfg?: Partial<KovaConfig>;
    channel?: string | null;
    accountId?: string | null;
}): string[] | undefined;
