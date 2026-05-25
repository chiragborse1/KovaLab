import type { KovaConfig } from "../config/types.kova.js";
type ChannelPresenceOptions = {
    includePersistedAuthState?: boolean;
    persistedAuthStateProbe?: {
        listChannelIds: () => readonly string[];
        hasState: (params: {
            channelId: string;
            cfg: KovaConfig;
            env: NodeJS.ProcessEnv;
        }) => boolean;
    };
};
export type ChannelPresenceSignalSource = "config" | "env" | "persisted-auth";
export type ChannelPresenceSignal = {
    channelId: string;
    source: ChannelPresenceSignalSource;
};
export declare function hasMeaningfulChannelConfig(value: unknown): boolean;
export declare function listPotentialConfiguredChannelIds(cfg: KovaConfig, env?: NodeJS.ProcessEnv, options?: ChannelPresenceOptions): string[];
export declare function listPotentialConfiguredChannelPresenceSignals(cfg: KovaConfig, env?: NodeJS.ProcessEnv, options?: ChannelPresenceOptions): ChannelPresenceSignal[];
export declare function hasPotentialConfiguredChannels(cfg: KovaConfig | null | undefined, env?: NodeJS.ProcessEnv, options?: ChannelPresenceOptions): boolean;
export {};
