import { resolveChannelGroupRequireMention } from "getkova/plugin-sdk/channel-policy";
import type { KovaConfig } from "getkova/plugin-sdk/core";

type GoogleChatGroupContext = {
  cfg: KovaConfig;
  accountId?: string | null;
  groupId?: string | null;
};

export function resolveGoogleChatGroupRequireMention(params: GoogleChatGroupContext): boolean {
  return resolveChannelGroupRequireMention({
    cfg: params.cfg,
    channel: "googlechat",
    groupId: params.groupId,
    accountId: params.accountId,
  });
}
