import type { KovaConfig } from "../../config/types.kova.js";
import type { AgentRuntimeAuthPlan } from "./types.js";
export declare function buildAgentRuntimeAuthPlan(params: {
    provider: string;
    authProfileProvider?: string;
    sessionAuthProfileId?: string;
    config?: KovaConfig;
    workspaceDir?: string;
    harnessId?: string;
    harnessRuntime?: string;
    allowHarnessAuthProfileForwarding?: boolean;
}): AgentRuntimeAuthPlan;
