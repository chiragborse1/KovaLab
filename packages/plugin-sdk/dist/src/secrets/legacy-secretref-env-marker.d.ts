import type { KovaConfig } from "../config/types.kova.js";
import { type SecretRef } from "../config/types.secrets.js";
export type LegacySecretRefEnvMarkerCandidate = {
    path: string;
    pathSegments: string[];
    value: string;
    ref: SecretRef | null;
};
export declare function collectLegacySecretRefEnvMarkerCandidates(config: KovaConfig): LegacySecretRefEnvMarkerCandidate[];
export declare function migrateLegacySecretRefEnvMarkers(config: KovaConfig): {
    config: KovaConfig;
    changes: string[];
};
