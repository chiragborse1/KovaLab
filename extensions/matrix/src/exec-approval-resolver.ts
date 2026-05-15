import { resolveApprovalOverGateway } from "getkova/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "getkova/plugin-sdk/approval-runtime";
import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { isApprovalNotFoundError } from "getkova/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: KovaConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
