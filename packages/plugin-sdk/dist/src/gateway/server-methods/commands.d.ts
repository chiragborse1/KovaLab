import type { KovaConfig } from "../../config/types.kova.js";
import type { CommandsListResult } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
export declare function buildCommandsListResult(params: {
    cfg: KovaConfig;
    agentId: string;
    provider?: string;
    scope?: "native" | "text" | "both";
    includeArgs?: boolean;
}): CommandsListResult;
export declare const commandsHandlers: GatewayRequestHandlers;
