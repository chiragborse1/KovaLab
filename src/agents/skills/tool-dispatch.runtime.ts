import type { SessionEntry } from "../../config/sessions.js";
import type { KovaConfig } from "../../config/types.kova.js";
import { logVerbose } from "../../globals.js";
import { getPluginToolMeta } from "../../plugins/tools.js";
import { resolveGatewayMessageChannel } from "../../utils/message-channel.js";
import { createKovaTools } from "../kova-tools.runtime.js";
import {
  resolveEffectiveToolPolicy,
  resolveGroupToolPolicy,
  resolveSubagentToolPolicyForSession,
} from "../pi-tools.policy.js";
import type { AnyAgentTool } from "../pi-tools.types.js";
import { resolveSandboxRuntimeStatus } from "../sandbox/runtime-status.js";
import type { SkillCommandSpec } from "../skills.js";
import {
  isSubagentEnvelopeSession,
  resolveSubagentCapabilityStore,
} from "../subagent-capabilities.js";
import {
  applyToolPolicyPipeline,
  buildDefaultToolPolicyPipelineSteps,
} from "../tool-policy-pipeline.js";
import {
  applyOwnerOnlyToolPolicy,
  collectExplicitAllowlist,
  collectExplicitDenylist,
  mergeAlsoAllowPolicy,
  resolveToolProfilePolicy,
} from "../tool-policy.js";

type SkillDispatchMessageContext = {
  surface?: string;
  provider?: string;
  accountId?: string;
  senderId?: string;
  senderName?: string;
  senderUsername?: string;
  senderE164?: string;
  originatingTo?: string;
  to?: string;
  messageThreadId?: string | number;
  messageId?: string | number;
  memberRoleIds?: string[];
};

export function resolveSkillDispatchTools(params: {
  message: SkillDispatchMessageContext;
  cfg: KovaConfig;
  agentId: string;
  agentDir?: string;
  sessionEntry?: SessionEntry;
  sessionKey: string;
  workspaceDir: string;
  provider: string;
  model: string;
  senderId?: string;
  senderIsOwner: boolean;
  currentChannelId?: string;
  skillCommand?: Pick<SkillCommandSpec, "name" | "skillName" | "skillSource"> & {
    toolName?: string;
  };
  groupId?: string;
}): AnyAgentTool[] {
  const channel =
    resolveGatewayMessageChannel(params.message.surface) ??
    resolveGatewayMessageChannel(params.message.provider) ??
    undefined;
  const {
    agentId: resolvedAgentId,
    globalPolicy,
    globalProviderPolicy,
    agentPolicy,
    agentProviderPolicy,
    profile,
    providerProfile,
    profileAlsoAllow,
    providerProfileAlsoAllow,
  } = resolveEffectiveToolPolicy({
    config: params.cfg,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    modelProvider: params.provider,
    modelId: params.model,
  });
  const profilePolicy = resolveToolProfilePolicy(profile);
  const providerProfilePolicy = resolveToolProfilePolicy(providerProfile);
  const profilePolicyWithAlsoAllow = mergeAlsoAllowPolicy(profilePolicy, profileAlsoAllow);
  const providerProfilePolicyWithAlsoAllow = mergeAlsoAllowPolicy(
    providerProfilePolicy,
    providerProfileAlsoAllow,
  );
  const groupId = params.sessionEntry?.groupId ?? params.groupId;
  const groupPolicy = resolveGroupToolPolicy({
    config: params.cfg,
    sessionKey: params.sessionKey,
    spawnedBy: params.sessionEntry?.spawnedBy,
    messageProvider: channel,
    groupId,
    groupChannel: params.sessionEntry?.groupChannel,
    groupSpace: params.sessionEntry?.space,
    accountId: params.message.accountId,
    senderId: params.message.senderId ?? params.senderId,
    senderName: params.message.senderName,
    senderUsername: params.message.senderUsername,
    senderE164: params.message.senderE164,
  });
  const sandboxRuntime = resolveSandboxRuntimeStatus({
    cfg: params.cfg,
    sessionKey: params.sessionKey,
  });
  const sandboxPolicy = sandboxRuntime.sandboxed ? sandboxRuntime.toolPolicy : undefined;
  const subagentStore = resolveSubagentCapabilityStore(params.sessionKey, {
    cfg: params.cfg,
  });
  const subagentPolicy = isSubagentEnvelopeSession(params.sessionKey, {
    cfg: params.cfg,
    store: subagentStore,
  })
    ? resolveSubagentToolPolicyForSession(params.cfg, params.sessionKey, {
        store: subagentStore,
      })
    : undefined;
  const explicitPolicyList = [
    profilePolicy,
    providerProfilePolicy,
    globalPolicy,
    globalProviderPolicy,
    agentPolicy,
    agentProviderPolicy,
    groupPolicy,
    sandboxPolicy,
    subagentPolicy,
  ];
  const tools = createKovaTools({
    agentSessionKey: params.sessionKey,
    agentChannel: channel,
    agentAccountId: params.message.accountId,
    agentTo: params.message.originatingTo ?? params.message.to,
    agentThreadId: params.message.messageThreadId ?? undefined,
    agentGroupId: groupId,
    agentGroupChannel: params.sessionEntry?.groupChannel,
    agentGroupSpace: params.sessionEntry?.space,
    agentMemberRoleIds: params.message.memberRoleIds,
    agentDir: params.agentDir,
    workspaceDir: params.workspaceDir,
    config: params.cfg,
    allowGatewaySubagentBinding: true,
    sandboxed: sandboxRuntime.sandboxed,
    requesterAgentIdOverride: params.agentId,
    requesterSenderId: params.senderId,
    senderIsOwner: params.senderIsOwner,
    sessionId: params.sessionEntry?.sessionId,
    currentChannelId: params.currentChannelId,
    currentThreadTs:
      typeof params.message.messageThreadId === "string"
        ? params.message.messageThreadId
        : undefined,
    currentMessageId: params.message.messageId,
    modelProvider: params.provider,
    modelId: params.model,
    pluginToolAllowlist: collectExplicitAllowlist(explicitPolicyList),
    pluginToolDenylist: collectExplicitDenylist(explicitPolicyList),
  });
  const ownerFiltered = applyOwnerOnlyToolPolicy(tools, params.senderIsOwner);
  return applyToolPolicyPipeline({
    tools: ownerFiltered,
    toolMeta: (tool) => getPluginToolMeta(tool),
    warn: logVerbose,
    steps: [
      ...buildDefaultToolPolicyPipelineSteps({
        profilePolicy: profilePolicyWithAlsoAllow,
        profile,
        profileUnavailableCoreWarningAllowlist: profilePolicy?.allow,
        providerProfilePolicy: providerProfilePolicyWithAlsoAllow,
        providerProfile,
        providerProfileUnavailableCoreWarningAllowlist: providerProfilePolicy?.allow,
        globalPolicy,
        globalProviderPolicy,
        agentPolicy,
        agentProviderPolicy,
        groupPolicy,
        agentId: resolvedAgentId,
      }),
      { policy: sandboxPolicy, label: "sandbox tools.allow" },
      { policy: subagentPolicy, label: "subagent tools.allow" },
    ],
  });
}
