import type { KovaConfig } from "../../config/types.kova.js";
import type { DeliveryContext } from "../../utils/delivery-context.js";
import { type ToolModelConfig } from "./model-config.helpers.js";
import { type AnyAgentTool, type SandboxFsBridge, type ToolFsPolicy } from "./tool-runtime.helpers.js";
export declare function resolveMusicGenerationModelConfigForTool(params: {
    cfg?: KovaConfig;
    agentDir?: string;
}): ToolModelConfig | null;
type MusicGenerateSandboxConfig = {
    root: string;
    bridge: SandboxFsBridge;
};
type MusicGenerateBackgroundScheduler = (work: () => Promise<void>) => void;
export declare function createMusicGenerateTool(options?: {
    config?: KovaConfig;
    agentDir?: string;
    agentSessionKey?: string;
    requesterOrigin?: DeliveryContext;
    workspaceDir?: string;
    sandbox?: MusicGenerateSandboxConfig;
    fsPolicy?: ToolFsPolicy;
    scheduleBackgroundWork?: MusicGenerateBackgroundScheduler;
}): AnyAgentTool | null;
export {};
