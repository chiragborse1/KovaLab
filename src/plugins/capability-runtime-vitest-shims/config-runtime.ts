import { resolveActiveTalkProviderConfig } from "../../config/talk.js";
import type { KovaConfig } from "../../config/types.js";

export { resolveActiveTalkProviderConfig };

export function getRuntimeConfigSnapshot(): KovaConfig | null {
  return null;
}
