import type { SessionEntry } from "../../config/sessions.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { ReplyPayload } from "../types.js";
import type { CommandHandler } from "./commands-types.js";
type ModelsCommandSessionEntry = Partial<Pick<SessionEntry, "authProfileOverride" | "modelProvider" | "model">>;
export type ModelsProviderData = {
    byProvider: Map<string, Set<string>>;
    providers: string[];
    resolvedDefault: {
        provider: string;
        model: string;
    };
    modelNames: Map<string, string>;
    runtimeChoicesByProvider?: Map<string, ModelsRuntimeChoice[]>;
};
export type ModelsRuntimeChoice = {
    id: string;
    label: string;
    description: string;
};
export declare function buildModelsProviderData(cfg: KovaConfig, agentId?: string): Promise<ModelsProviderData>;
export declare function formatModelsAvailableHeader(params: {
    provider: string;
    total: number;
    cfg: KovaConfig;
    agentId?: string;
    agentDir?: string;
    sessionEntry?: ModelsCommandSessionEntry;
}): string;
export declare function resolveModelsCommandReply(params: {
    cfg: KovaConfig;
    commandBodyNormalized: string;
    surface?: string;
    currentModel?: string;
    agentId?: string;
    agentDir?: string;
    sessionEntry?: ModelsCommandSessionEntry;
}): Promise<ReplyPayload | null>;
export declare const handleModelsCommand: CommandHandler;
export {};
