import type { ModelCatalogProvider } from "../types.js";
export type KovaProviderIndexPluginInstall = {
    npmSpec: string;
    defaultChoice?: "npm";
    minHostVersion?: string;
    expectedIntegrity?: string;
};
export type KovaProviderIndexPlugin = {
    id: string;
    package?: string;
    source?: string;
    install?: KovaProviderIndexPluginInstall;
};
export type KovaProviderIndexProviderAuthChoice = {
    method: string;
    choiceId: string;
    choiceLabel: string;
    choiceHint?: string;
    assistantPriority?: number;
    assistantVisibility?: "visible" | "manual-only";
    groupId?: string;
    groupLabel?: string;
    groupHint?: string;
    optionKey?: string;
    cliFlag?: string;
    cliOption?: string;
    cliDescription?: string;
    onboardingScopes?: readonly ("text-inference" | "image-generation")[];
};
export type KovaProviderIndexProvider = {
    id: string;
    name: string;
    plugin: KovaProviderIndexPlugin;
    docs?: string;
    categories?: readonly string[];
    authChoices?: readonly KovaProviderIndexProviderAuthChoice[];
    previewCatalog?: ModelCatalogProvider;
};
export type KovaProviderIndex = {
    version: number;
    providers: Readonly<Record<string, KovaProviderIndexProvider>>;
};
