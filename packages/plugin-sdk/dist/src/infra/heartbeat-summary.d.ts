import type { AgentDefaultsConfig } from "../config/types.agent-defaults.js";
import type { KovaConfig } from "../config/types.kova.js";
type HeartbeatConfig = AgentDefaultsConfig["heartbeat"];
export type HeartbeatSummary = {
    enabled: boolean;
    every: string;
    everyMs: number | null;
    prompt: string;
    target: string;
    model?: string;
    ackMaxChars: number;
};
export declare function isHeartbeatEnabledForAgent(cfg: KovaConfig, agentId?: string): boolean;
export declare function resolveHeartbeatIntervalMs(cfg: KovaConfig, overrideEvery?: string, heartbeat?: HeartbeatConfig): number | null;
export declare function resolveHeartbeatSummaryForAgent(cfg: KovaConfig, agentId?: string): HeartbeatSummary;
export {};
