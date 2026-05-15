import { resolveChannelGroupRequireMention } from "getkova/plugin-sdk/channel-policy";
import { resolveExactLineGroupConfigKey, type KovaConfig } from "./channel-api.js";

type LineGroupContext = {
  cfg: KovaConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveLineGroupRequireMention(params: LineGroupContext): boolean {
  const exactGroupId = resolveExactLineGroupConfigKey({
    cfg: params.cfg,
    accountId: params.accountId,
    groupId: params.groupId,
  });
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "line",
    groupId: exactGroupId ?? params.groupId,
    accountId: params.accountId,
  });
}
