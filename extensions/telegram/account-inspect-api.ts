import type { KovaConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: KovaConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
