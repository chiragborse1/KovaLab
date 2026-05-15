import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: KovaConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
