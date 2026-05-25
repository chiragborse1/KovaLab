import type { KovaConfig } from "../config/types.kova.js";
import type { ResolverContext } from "./runtime-shared.js";
import type { RuntimeWebDiagnostic, RuntimeWebDiagnosticCode, RuntimeWebFetchMetadata, RuntimeWebSearchMetadata, RuntimeWebToolsMetadata } from "./runtime-web-tools.types.js";
export type { RuntimeWebDiagnostic, RuntimeWebDiagnosticCode, RuntimeWebFetchMetadata, RuntimeWebSearchMetadata, RuntimeWebToolsMetadata, };
export declare function resolveRuntimeWebTools(params: {
    sourceConfig: KovaConfig;
    resolvedConfig: KovaConfig;
    context: ResolverContext;
}): Promise<RuntimeWebToolsMetadata>;
