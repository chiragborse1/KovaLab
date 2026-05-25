import type { KovaConfig } from "../config/types.kova.js";
import type { ExecApprovalDecision } from "./exec-approvals.js";
export type ResolveApprovalOverGatewayParams = {
    cfg: KovaConfig;
    approvalId: string;
    decision: ExecApprovalDecision;
    senderId?: string | null;
    allowPluginFallback?: boolean;
    resolveMethod?: "plugin";
    gatewayUrl?: string;
    clientDisplayName?: string;
};
export declare function resolveApprovalOverGateway(params: ResolveApprovalOverGatewayParams): Promise<void>;
