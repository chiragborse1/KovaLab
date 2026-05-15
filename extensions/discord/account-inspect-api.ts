import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: KovaConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
