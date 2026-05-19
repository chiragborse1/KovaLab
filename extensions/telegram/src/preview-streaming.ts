import {
  resolveChannelPreviewStreamMode,
  type StreamingMode,
} from "getkova/plugin-sdk/channel-streaming";

export type TelegramPreviewStreamMode = StreamingMode;

export function resolveTelegramPreviewStreamMode(
  params: {
    streamMode?: unknown;
    streaming?: unknown;
  } = {},
): TelegramPreviewStreamMode {
  return resolveChannelPreviewStreamMode(params, "partial");
}
