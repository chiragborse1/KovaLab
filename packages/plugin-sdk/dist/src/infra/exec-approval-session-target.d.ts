import type { KovaConfig } from "../config/types.kova.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import type { PluginApprovalRequest } from "./plugin-approvals.js";
export { doesApprovalRequestMatchChannelAccount, resolveApprovalRequestAccountId, resolveApprovalRequestChannelAccountId, } from "./approval-request-account-binding.js";
export type ExecApprovalSessionTarget = {
    channel?: string;
    to: string;
    accountId?: string;
    threadId?: string | number;
};
export type ApprovalRequestSessionConversation = {
    channel: string;
    kind: "group" | "channel";
    id: string;
    rawId: string;
    threadId?: string;
    baseSessionKey: string;
    baseConversationId: string;
    parentConversationCandidates: string[];
};
type ApprovalRequestLike = ExecApprovalRequest | PluginApprovalRequest;
type ApprovalRequestOriginTargetResolver<TTarget> = {
    cfg: KovaConfig;
    request: ApprovalRequestLike;
    channel: string;
    accountId?: string | null;
    resolveTurnSourceTarget: (request: ApprovalRequestLike) => TTarget | null;
    resolveSessionTarget: (sessionTarget: ExecApprovalSessionTarget) => TTarget | null;
    targetsMatch: (a: TTarget, b: TTarget) => boolean;
    resolveFallbackTarget?: (request: ApprovalRequestLike) => TTarget | null;
};
export declare function resolveApprovalRequestSessionConversation(params: {
    request: ApprovalRequestLike;
    channel?: string | null;
    bundledFallback?: boolean;
}): ApprovalRequestSessionConversation | null;
export declare function resolveExecApprovalSessionTarget(params: {
    cfg: KovaConfig;
    request: ExecApprovalRequest;
    turnSourceChannel?: string | null;
    turnSourceTo?: string | null;
    turnSourceAccountId?: string | null;
    turnSourceThreadId?: string | number | null;
}): ExecApprovalSessionTarget | null;
export declare function resolveApprovalRequestSessionTarget(params: {
    cfg: KovaConfig;
    request: ApprovalRequestLike;
}): ExecApprovalSessionTarget | null;
export declare function resolveApprovalRequestOriginTarget<TTarget>(params: ApprovalRequestOriginTargetResolver<TTarget>): TTarget | null;
