import type { AgentAcpBinding, AgentBinding, AgentRouteBinding } from "./types.agents.js";
import type { KovaConfig } from "./types.kova.js";
export type ConfiguredBindingRule = AgentBinding;
export declare function isRouteBinding(binding: AgentBinding): binding is AgentRouteBinding;
export declare function isAcpBinding(binding: AgentBinding): binding is AgentAcpBinding;
export declare function listConfiguredBindings(cfg: KovaConfig): AgentBinding[];
export declare function listRouteBindings(cfg: KovaConfig): AgentRouteBinding[];
export declare function listAcpBindings(cfg: KovaConfig): AgentAcpBinding[];
