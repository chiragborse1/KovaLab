import type { KovaConfig } from "./config.js";
export declare function resolveChannelConfigRecord(cfg: KovaConfig, channelId: string): Record<string, unknown> | null;
export declare function hasMeaningfulChannelConfigShallow(value: unknown): boolean;
export declare function isStaticallyChannelConfigured(cfg: KovaConfig, channelId: string, env?: NodeJS.ProcessEnv): boolean;
