import type { KovaConfig } from "../../config/types.kova.js";
import { type ToolModelConfig } from "./model-config.helpers.js";
import { type AnyAgentTool, type SandboxFsBridge, type ToolFsPolicy } from "./tool-runtime.helpers.js";
export declare function resolveImageGenerationModelConfigForTool(params: {
    cfg?: KovaConfig;
    agentDir?: string;
}): ToolModelConfig | null;
type ImageGenerateSandboxConfig = {
    root: string;
    bridge: SandboxFsBridge;
};
export declare function createImageGenerateTool(options?: {
    config?: KovaConfig;
    agentDir?: string;
    workspaceDir?: string;
    sandbox?: ImageGenerateSandboxConfig;
    fsPolicy?: ToolFsPolicy;
}): AnyAgentTool | null;
export {};
