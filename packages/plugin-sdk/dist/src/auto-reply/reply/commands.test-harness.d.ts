import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
import type { HandleCommandsParams } from "./commands-types.js";
export declare const baseCommandTestConfig: KovaConfig;
export declare function buildCommandTestParams(commandBody: string, cfg: KovaConfig, ctxOverrides?: Partial<MsgContext>, options?: {
    workspaceDir?: string;
}): HandleCommandsParams;
export declare function configureInMemoryTaskRegistryStoreForTests(): void;
export declare function buildPluginsCommandParams(params: {
    commandBodyNormalized: string;
    cfg?: KovaConfig;
    workspaceDir?: string;
    gatewayClientScopes?: string[];
}): HandleCommandsParams;
