import type { KovaConfig } from "../config/types.kova.js";
export type ApprovalCommandAuthorization = {
    authorized: boolean;
    reason?: string;
    explicit: boolean;
};
export declare function resolveApprovalCommandAuthorization(params: {
    cfg: KovaConfig;
    channel?: string | null;
    accountId?: string | null;
    senderId?: string | null;
    kind: "exec" | "plugin";
}): ApprovalCommandAuthorization;
