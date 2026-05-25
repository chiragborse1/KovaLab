import type { KovaConfig } from "../../config/types.kova.js";
type CommandSurfaceParams = {
    ctx: {
        OriginatingChannel?: string;
        Surface?: string;
        Provider?: string;
        AccountId?: string;
    };
    command: {
        channel?: string;
    };
};
type ChannelAccountParams = {
    cfg: KovaConfig;
    ctx: {
        OriginatingChannel?: string;
        Surface?: string;
        Provider?: string;
        AccountId?: string;
    };
    command: {
        channel?: string;
    };
};
export declare function resolveCommandSurfaceChannel(params: CommandSurfaceParams): string;
export declare function resolveChannelAccountId(params: ChannelAccountParams): string;
export {};
