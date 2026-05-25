import type { KovaConfig } from "../config/types.js";
import type { ChatCommandDefinition, CommandDetection, CommandNormalizeOptions } from "./commands-registry.types.js";
export declare function normalizeCommandBody(raw: string, options?: CommandNormalizeOptions): string;
export declare function getCommandDetection(_cfg?: KovaConfig): CommandDetection;
export declare function maybeResolveTextAlias(raw: string, cfg?: KovaConfig): string | null;
export declare function resolveTextCommand(raw: string, cfg?: KovaConfig): {
    command: ChatCommandDefinition;
    args?: string;
} | null;
