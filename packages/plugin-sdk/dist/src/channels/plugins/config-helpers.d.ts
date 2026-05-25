import type { KovaConfig } from "../../config/types.kova.js";
export declare function setAccountEnabledInConfigSection(params: {
    cfg: KovaConfig;
    sectionKey: string;
    accountId: string;
    enabled: boolean;
    allowTopLevel?: boolean;
}): KovaConfig;
export declare function deleteAccountFromConfigSection(params: {
    cfg: KovaConfig;
    sectionKey: string;
    accountId: string;
    clearBaseFields?: string[];
}): KovaConfig;
export declare function clearAccountEntryFields<TAccountEntry extends object>(params: {
    accounts?: Record<string, TAccountEntry>;
    accountId: string;
    fields: string[];
    isValueSet?: (value: unknown) => boolean;
    markClearedOnFieldPresence?: boolean;
}): {
    nextAccounts?: Record<string, TAccountEntry>;
    changed: boolean;
    cleared: boolean;
};
