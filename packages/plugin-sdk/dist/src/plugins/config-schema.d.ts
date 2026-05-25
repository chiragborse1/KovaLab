import { type ZodTypeAny } from "zod";
import type { JsonSchemaObject } from "../shared/json-schema.types.js";
import type { PluginConfigUiHint } from "./manifest-types.js";
import type { KovaPluginConfigSchema } from "./types.js";
type BuildPluginConfigSchemaOptions = {
    uiHints?: Record<string, PluginConfigUiHint>;
    safeParse?: KovaPluginConfigSchema["safeParse"];
};
type BuildJsonPluginConfigSchemaOptions = {
    cacheKey?: string;
    uiHints?: Record<string, PluginConfigUiHint>;
    safeParse?: KovaPluginConfigSchema["safeParse"];
};
export declare function buildJsonPluginConfigSchema(schema: JsonSchemaObject, options?: BuildJsonPluginConfigSchemaOptions): KovaPluginConfigSchema;
export declare function buildPluginConfigSchema(schema: ZodTypeAny, options?: BuildPluginConfigSchemaOptions): KovaPluginConfigSchema;
export declare function emptyPluginConfigSchema(): KovaPluginConfigSchema;
export {};
