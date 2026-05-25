import type { SessionEntry } from "../config/sessions/types.js";
import type { KovaConfig } from "../config/types.kova.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import type { PluginApprovalRequest } from "./plugin-approvals.js";
export type ApprovalRequestLike = ExecApprovalRequest | PluginApprovalRequest;
export type PersistedApprovalRequestSessionEntry = {
    sessionKey: string;
    entry: SessionEntry;
};
export declare function resolvePersistedApprovalRequestSessionEntry(params: {
    cfg: KovaConfig;
    request: ApprovalRequestLike;
}): PersistedApprovalRequestSessionEntry | null;
export declare function resolveApprovalRequestAccountId(params: {
    cfg: KovaConfig;
    request: ApprovalRequestLike;
    channel?: string | null;
}): string | null;
export declare function resolveApprovalRequestChannelAccountId(params: {
    cfg: KovaConfig;
    request: ApprovalRequestLike;
    channel: string;
}): string | null;
export declare function doesApprovalRequestMatchChannelAccount(params: {
    cfg: KovaConfig;
    request: ApprovalRequestLike;
    channel: string;
    accountId?: string | null;
}): boolean;
