import type { KovaConfig } from "../config/types.kova.js";
import { type ErrorShape, type SessionsResolveParams } from "./protocol/index.js";
export type SessionsResolveResult = {
    ok: true;
    key: string;
} | {
    ok: false;
    error: ErrorShape;
};
export declare function resolveSessionKeyFromResolveParams(params: {
    cfg: KovaConfig;
    p: SessionsResolveParams;
}): Promise<SessionsResolveResult>;
