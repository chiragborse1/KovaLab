import type { SessionEntry } from "../config/sessions.js";
import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveModelAuthLabel(params: {
    provider?: string;
    cfg?: KovaConfig;
    sessionEntry?: Partial<Pick<SessionEntry, "authProfileOverride">>;
    agentDir?: string;
    includeExternalProfiles?: boolean;
    acceptedProviderIds?: readonly string[];
}): string | undefined;
