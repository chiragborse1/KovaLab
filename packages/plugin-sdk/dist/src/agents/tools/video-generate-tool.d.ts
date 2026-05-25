import type { KovaConfig } from "../../config/types.kova.js";
import type { DeliveryContext } from "../../utils/delivery-context.js";
import { type ToolModelConfig } from "./model-config.helpers.js";
import { type AnyAgentTool, type SandboxFsBridge, type ToolFsPolicy } from "./tool-runtime.helpers.js";
export declare function resolveVideoGenerationModelConfigForTool(params: {
    cfg?: KovaConfig;
    agentDir?: string;
}): ToolModelConfig | null;
type VideoGenerateSandboxConfig = {
    root: string;
    bridge: SandboxFsBridge;
};
type VideoGenerateBackgroundScheduler = (work: () => Promise<void>) => void;
export declare function createVideoGenerateTool(options?: {
    config?: KovaConfig;
    agentDir?: string;
    agentSessionKey?: string;
    requesterOrigin?: DeliveryContext;
    workspaceDir?: string;
    sandbox?: VideoGenerateSandboxConfig;
    fsPolicy?: ToolFsPolicy;
    scheduleBackgroundWork?: VideoGenerateBackgroundScheduler;
}): AnyAgentTool | null;
export {};
