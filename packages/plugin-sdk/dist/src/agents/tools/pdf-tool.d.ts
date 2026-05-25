import { Type } from "typebox";
import type { KovaConfig } from "../../config/types.kova.js";
import { type AnyAgentTool, type SandboxFsBridge, type ToolFsPolicy } from "./tool-runtime.helpers.js";
export declare const PdfToolSchema: Type.TObject<{
    prompt: Type.TOptional<Type.TString>;
    pdf: Type.TOptional<Type.TString>;
    pdfs: Type.TOptional<Type.TArray<Type.TString>>;
    pages: Type.TOptional<Type.TString>;
    model: Type.TOptional<Type.TString>;
    maxBytesMb: Type.TOptional<Type.TNumber>;
}>;
export { resolvePdfModelConfigForTool } from "./pdf-tool.model-config.js";
type PdfSandboxConfig = {
    root: string;
    bridge: SandboxFsBridge;
};
export declare function createPdfTool(options?: {
    config?: KovaConfig;
    agentDir?: string;
    workspaceDir?: string;
    sandbox?: PdfSandboxConfig;
    fsPolicy?: ToolFsPolicy;
}): AnyAgentTool | null;
