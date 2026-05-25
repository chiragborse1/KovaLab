import type { KovaConfig } from "../types.kova.js";
import type { SessionEntry } from "./types.js";
export declare function loadCombinedSessionStoreForGateway(cfg: KovaConfig): {
    storePath: string;
    store: Record<string, SessionEntry>;
};
