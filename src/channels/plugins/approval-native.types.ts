import type { KovaConfig } from "../../config/types.kova.js";
import type { ChannelApprovalKind } from "../../infra/approval-types.js";
import type { ExecApprovalRequest } from "../../infra/exec-approvals.js";
import type { PluginApprovalRequest } from "../../infra/plugin-approvals.js";

export type ChannelApprovalNativeSurface = "origin" | "approver-dm";

export type ChannelApprovalNativeTarget = {
  to: string;
  threadId?: string | number | null;
};

export type ChannelApprovalNativeDeliveryPreference = ChannelApprovalNativeSurface | "both";

export type ChannelApprovalNativeRequest = ExecApprovalRequest | PluginApprovalRequest;

export type ChannelApprovalNativeDeliveryCapabilities = {
  enabled: boolean;
  preferredSurface: ChannelApprovalNativeDeliveryPreference;
  supportsOriginSurface: boolean;
  supportsApproverDmSurface: boolean;
  notifyOriginWhenDmOnly?: boolean;
};

export type ChannelApprovalNativeAdapter = {
  describeDeliveryCapabilities: (params: {
    cfg: KovaConfig;
    accountId?: string | null;
    approvalKind: ChannelApprovalKind;
    request: ChannelApprovalNativeRequest;
  }) => ChannelApprovalNativeDeliveryCapabilities;
  resolveOriginTarget?: (params: {
    cfg: KovaConfig;
    accountId?: string | null;
    approvalKind: ChannelApprovalKind;
    request: ChannelApprovalNativeRequest;
  }) => ChannelApprovalNativeTarget | null | Promise<ChannelApprovalNativeTarget | null>;
  resolveApproverDmTargets?: (params: {
    cfg: KovaConfig;
    accountId?: string | null;
    approvalKind: ChannelApprovalKind;
    request: ChannelApprovalNativeRequest;
  }) => ChannelApprovalNativeTarget[] | Promise<ChannelApprovalNativeTarget[]>;
};
