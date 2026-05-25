import type { KovaConfig } from "../../config/types.kova.js";
import type { WizardPrompter } from "../../wizard/prompts.js";
import { type ChannelAccessPolicy } from "./setup-group-access.js";
export declare function configureChannelAccessWithAllowlist<TResolved>(params: {
    cfg: KovaConfig;
    prompter: WizardPrompter;
    label: string;
    currentPolicy: ChannelAccessPolicy;
    currentEntries: string[];
    placeholder: string;
    updatePrompt: boolean;
    skipAllowlistEntries?: boolean;
    setPolicy: (cfg: KovaConfig, policy: ChannelAccessPolicy) => KovaConfig;
    resolveAllowlist?: (params: {
        cfg: KovaConfig;
        entries: string[];
    }) => Promise<TResolved>;
    applyAllowlist?: (params: {
        cfg: KovaConfig;
        resolved: TResolved;
    }) => KovaConfig;
}): Promise<KovaConfig>;
