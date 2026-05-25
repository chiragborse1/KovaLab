import { SettingsManager } from "@mariozechner/pi-coding-agent";
import type { KovaConfig } from "../config/types.kova.js";
export { buildEmbeddedPiSettingsSnapshot, loadEnabledBundlePiSettingsSnapshot, resolveEmbeddedPiProjectSettingsPolicy, } from "./pi-project-settings-snapshot.js";
export declare function createEmbeddedPiSettingsManager(params: {
    cwd: string;
    agentDir: string;
    cfg?: KovaConfig;
}): SettingsManager;
export declare function createPreparedEmbeddedPiSettingsManager(params: {
    cwd: string;
    agentDir: string;
    cfg?: KovaConfig;
    /** Resolved context window budget so reserve-token floor can be capped for small models. */
    contextTokenBudget?: number;
}): SettingsManager;
