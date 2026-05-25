import { type Api, type Model } from "@mariozechner/pi-ai";
import type { KovaConfig } from "../config/types.kova.js";
export declare function prepareModelForSimpleCompletion<TApi extends Api>(params: {
    model: Model<TApi>;
    cfg?: KovaConfig;
}): Model<Api>;
