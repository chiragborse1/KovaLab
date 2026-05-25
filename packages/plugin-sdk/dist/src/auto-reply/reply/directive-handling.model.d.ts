import { type ModelAliasIndex } from "../../agents/model-selection.js";
import type { SessionEntry } from "../../config/sessions.js";
import type { KovaConfig } from "../../config/types.kova.js";
import type { ReplyPayload } from "../types.js";
export { resolveModelSelectionFromDirective } from "./directive-handling.model-selection.js";
import type { InlineDirectives } from "./directive-handling.parse.js";
export declare function maybeHandleModelDirectiveInfo(params: {
    directives: InlineDirectives;
    cfg: KovaConfig;
    agentDir: string;
    activeAgentId: string;
    provider: string;
    model: string;
    defaultProvider: string;
    defaultModel: string;
    aliasIndex: ModelAliasIndex;
    allowedModelCatalog: Array<{
        provider: string;
        id?: string;
        name?: string;
    }>;
    resetModelOverride: boolean;
    surface?: string;
    sessionEntry?: Pick<SessionEntry, "modelProvider" | "model">;
}): Promise<ReplyPayload | undefined>;
