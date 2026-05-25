import type { KovaConfig } from "../../../config/types.kova.js";
import type { AgentRuntimePlan } from "../../runtime-plan/types.js";
import { type TranscriptPolicy } from "../../transcript-policy.js";
export type AttemptRuntimeModelContext = NonNullable<Parameters<AgentRuntimePlan["transcript"]["resolvePolicy"]>[0]>;
export declare function resolveAttemptTranscriptPolicy(params: {
    runtimePlan?: AgentRuntimePlan;
    runtimePlanModelContext: AttemptRuntimeModelContext;
    provider: string;
    modelId: string;
    config?: KovaConfig;
    env?: NodeJS.ProcessEnv;
}): TranscriptPolicy;
