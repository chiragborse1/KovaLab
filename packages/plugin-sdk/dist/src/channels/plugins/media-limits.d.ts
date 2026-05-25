import type { KovaConfig } from "../../config/types.kova.js";
export declare function resolveChannelMediaMaxBytes(params: {
    cfg: KovaConfig;
    resolveChannelLimitMb: (params: {
        cfg: KovaConfig;
        accountId: string;
    }) => number | undefined;
    accountId?: string | null;
}): number | undefined;
