import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";
import type { KovaConfig } from "../config/types.kova.js";
import { type InputProvenance } from "../sessions/input-provenance.js";
export type GuardedSessionManager = SessionManager & {
    /** Flush any synthetic tool results for pending tool calls. Idempotent. */
    flushPendingToolResults?: () => void;
    /** Clear pending tool calls without persisting synthetic tool results. Idempotent. */
    clearPendingToolResults?: () => void;
};
/**
 * Apply the tool-result guard to a SessionManager exactly once and expose
 * a flush method on the instance for easy teardown handling.
 */
export declare function guardSessionManager(sessionManager: SessionManager, opts?: {
    agentId?: string;
    sessionKey?: string;
    config?: KovaConfig;
    contextWindowTokens?: number;
    inputProvenance?: InputProvenance;
    allowSyntheticToolResults?: boolean;
    missingToolResultText?: string;
    allowedToolNames?: Iterable<string>;
    suppressNextUserMessagePersistence?: boolean;
    suppressTranscriptOnlyAssistantPersistence?: boolean;
    suppressAssistantErrorPersistence?: boolean;
    onUserMessagePersisted?: (message: Extract<AgentMessage, {
        role: "user";
    }>) => void | Promise<void>;
    onAssistantErrorMessagePersisted?: (message: Extract<AgentMessage, {
        role: "assistant";
    }>) => void | Promise<void>;
}): GuardedSessionManager;
