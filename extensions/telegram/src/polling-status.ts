import type { ChannelAccountSnapshot } from "getkova/plugin-sdk/channel-contract";
import {
  createConnectedChannelStatusPatch,
  createTransportActivityStatusPatch,
} from "getkova/plugin-sdk/gateway-runtime";

type TelegramPollingStatusSink = (patch: Omit<ChannelAccountSnapshot, "accountId">) => void;

export function createTelegramPollingStatusPublisher(setStatus?: TelegramPollingStatusSink) {
  return {
    notePollingStart() {
      setStatus?.({
        mode: "polling",
        connected: false,
        lastConnectedAt: null,
        lastEventAt: null,
        lastTransportActivityAt: null,
      });
    },
    notePollSuccess(at = Date.now()) {
      setStatus?.({
        ...createConnectedChannelStatusPatch(at),
        // A successful getUpdates call proves the Telegram HTTP long-poll is alive
        // even when the response has no user-visible updates.
        ...createTransportActivityStatusPatch(at),
        mode: "polling",
        lastError: null,
      });
    },
    notePollingStop() {
      setStatus?.({
        mode: "polling",
        connected: false,
      });
    },
    notePollingError(message: string, at = Date.now()) {
      setStatus?.({
        mode: "polling",
        connected: false,
        lastError: message,
        lastEventAt: at,
        lastTransportActivityAt: at,
      });
    },
  };
}
