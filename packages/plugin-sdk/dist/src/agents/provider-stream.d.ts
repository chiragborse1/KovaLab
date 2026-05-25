import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Api, Model } from "@mariozechner/pi-ai";
import type { KovaConfig } from "../config/types.kova.js";
export declare function registerProviderStreamForModel<TApi extends Api>(params: {
    model: Model<TApi>;
    cfg?: KovaConfig;
    agentDir?: string;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
}): StreamFn | undefined;
