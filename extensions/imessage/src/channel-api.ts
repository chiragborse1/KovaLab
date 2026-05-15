import { formatTrimmedAllowFromEntries } from "getkova/plugin-sdk/channel-config-helpers";
import type { ChannelStatusIssue } from "getkova/plugin-sdk/channel-contract";
import { PAIRING_APPROVED_MESSAGE } from "getkova/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
  type KovaConfig,
} from "getkova/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "getkova/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "getkova/plugin-sdk/status-helpers";
import {
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
} from "./config-accessors.js";
import { looksLikeIMessageTargetId, normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "getkova/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
};

export type { ChannelPlugin, ChannelStatusIssue, KovaConfig };
