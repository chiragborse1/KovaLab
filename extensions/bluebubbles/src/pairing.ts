import { createPairingPrefixStripper } from "getkova/plugin-sdk/channel-pairing";
import { PAIRING_APPROVED_MESSAGE } from "getkova/plugin-sdk/channel-status";
import type { KovaConfig } from "./runtime-api.js";
import { normalizeBlueBubblesHandle } from "./targets.js";

type SendBlueBubblesMessage = (
  id: string,
  message: string,
  params: {
    cfg: KovaConfig;
    accountId?: string;
  },
) => Promise<unknown>;

export function createBlueBubblesPairingText(sendMessageBlueBubbles: SendBlueBubblesMessage) {
  return {
    idLabel: "bluebubblesSenderId",
    message: PAIRING_APPROVED_MESSAGE,
    normalizeAllowEntry: createPairingPrefixStripper(/^bluebubbles:/i, normalizeBlueBubblesHandle),
    notify: async ({
      cfg,
      id,
      message,
      accountId,
    }: {
      cfg: KovaConfig;
      id: string;
      message: string;
      accountId?: string;
    }) => {
      await sendMessageBlueBubbles(id, message, {
        cfg,
        accountId,
      });
    },
  };
}
