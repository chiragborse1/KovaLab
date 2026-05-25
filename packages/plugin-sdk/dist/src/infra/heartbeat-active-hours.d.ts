import type { AgentDefaultsConfig } from "../config/types.agent-defaults.js";
import type { KovaConfig } from "../config/types.kova.js";
type HeartbeatConfig = AgentDefaultsConfig["heartbeat"];
export declare function isWithinActiveHours(cfg: KovaConfig, heartbeat?: HeartbeatConfig, nowMs?: number): boolean;
export {};
