import { getRuntimeConfig, type KovaConfig } from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): KovaConfig {
  return getRuntimeConfig();
}
