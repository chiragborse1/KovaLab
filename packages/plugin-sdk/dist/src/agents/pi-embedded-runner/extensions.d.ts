import type { ExtensionFactory, SessionManager } from "@mariozechner/pi-coding-agent";
import type { KovaConfig } from "../../config/types.kova.js";
import type { ProviderRuntimeModel } from "../../plugins/provider-runtime-model.types.js";
import { ensurePiCompactionReserveTokens } from "../pi-settings.js";
export declare function buildEmbeddedExtensionFactories(params: {
    cfg: KovaConfig | undefined;
    sessionManager: SessionManager;
    provider: string;
    modelId: string;
    model: ProviderRuntimeModel | undefined;
}): ExtensionFactory[];
export { ensurePiCompactionReserveTokens };
