import type { KovaConfig } from "../../config/types.kova.js";
import type { OutboundIdentity } from "./identity-types.js";
export type { OutboundIdentity } from "./identity-types.js";
export declare function normalizeOutboundIdentity(identity?: OutboundIdentity | null): OutboundIdentity | undefined;
export declare function resolveAgentOutboundIdentity(cfg: KovaConfig, agentId: string): OutboundIdentity | undefined;
