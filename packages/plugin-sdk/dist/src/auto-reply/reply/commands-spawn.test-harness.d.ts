import type { KovaConfig } from "../../config/types.kova.js";
import type { MsgContext } from "../templating.js";
export declare function buildCommandTestParams(commandBody: string, cfg: KovaConfig, ctxOverrides?: Partial<MsgContext>): import("./commands-types.ts").HandleCommandsParams;
