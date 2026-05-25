import type { KovaConfig } from "../../config/types.kova.js";
import { type LookupFn } from "../../infra/net/ssrf.js";
import type { RuntimeWebFetchMetadata } from "../../secrets/runtime-web-tools.types.js";
import type { AnyAgentTool } from "./common.js";
export { extractReadableContent } from "../../web-fetch/content-extractors.runtime.js";
export declare function createWebFetchTool(options?: {
    config?: KovaConfig;
    sandboxed?: boolean;
    runtimeWebFetch?: RuntimeWebFetchMetadata;
    lookupFn?: LookupFn;
}): AnyAgentTool | null;
