export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "getkova/plugin-sdk/channel-mention-gating";
export { hasControlCommand } from "getkova/plugin-sdk/command-detection";
export { recordPendingHistoryEntryIfEnabled } from "getkova/plugin-sdk/reply-history";
export { parseActivationCommand } from "getkova/plugin-sdk/group-activation";
export { normalizeE164 } from "../../text-runtime.js";
