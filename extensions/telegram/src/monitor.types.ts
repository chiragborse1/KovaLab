import type {
  ChannelAccountSnapshot,
  ChannelRuntimeSurface,
} from "getkova/plugin-sdk/channel-contract";
import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import type { RuntimeEnv } from "getkova/plugin-sdk/runtime-env";
import type { TelegramBotInfo } from "./bot-info.js";

export type MonitorTelegramOpts = {
  token?: string;
  accountId?: string;
  config?: KovaConfig;
  runtime?: RuntimeEnv;
  channelRuntime?: ChannelRuntimeSurface;
  abortSignal?: AbortSignal;
  useWebhook?: boolean;
  webhookPath?: string;
  webhookPort?: number;
  webhookSecret?: string;
  webhookHost?: string;
  proxyFetch?: typeof fetch;
  webhookUrl?: string;
  webhookCertPath?: string;
  botInfo?: TelegramBotInfo;
  setStatus?: (patch: Omit<ChannelAccountSnapshot, "accountId">) => void;
  isolatedIngress?: {
    enabled?: boolean;
  };
};

export type TelegramMonitorFn = (opts?: MonitorTelegramOpts) => Promise<void>;
