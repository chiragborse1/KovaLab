import { KOVA_PROVIDER_INDEX } from "./kova-provider-index.js";
import { normalizeKovaProviderIndex } from "./normalize.js";
import type { KovaProviderIndex } from "./types.js";

export function loadKovaProviderIndex(source: unknown = KOVA_PROVIDER_INDEX): KovaProviderIndex {
  return normalizeKovaProviderIndex(source) ?? { version: 1, providers: {} };
}
