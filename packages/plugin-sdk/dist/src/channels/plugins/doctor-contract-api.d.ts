import type { LegacyConfigRule } from "../../config/legacy.shared.js";
import type { KovaConfig } from "../../config/types.js";
type BundledChannelDoctorCompatibilityMutation = {
    config: KovaConfig;
    changes: string[];
};
type BundledChannelDoctorContractApi = {
    legacyConfigRules?: readonly LegacyConfigRule[];
    normalizeCompatibilityConfig?: (params: {
        cfg: KovaConfig;
    }) => BundledChannelDoctorCompatibilityMutation;
};
export declare function loadBundledChannelDoctorContractApi(channelId: string): BundledChannelDoctorContractApi | undefined;
export {};
