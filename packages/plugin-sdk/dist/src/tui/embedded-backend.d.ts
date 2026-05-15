import { type SkillStatusReport } from "../agents/skills-status.js";
import type { SessionsPatchResult } from "../gateway/protocol/index.js";
import type { ChatSendOptions, TuiAgentsList, TuiBackend, TuiEvent, TuiModelChoice, TuiSessionList } from "./tui-backend.js";
export declare class EmbeddedTuiBackend implements TuiBackend {
    readonly connection: {
        url: string;
    };
    onEvent?: (evt: TuiEvent) => void;
    onConnected?: () => void;
    onDisconnected?: (reason: string) => void;
    onGap?: (info: {
        expected: number;
        received: number;
    }) => void;
    private readonly deps;
    private readonly runs;
    private unsubscribe?;
    private previousRuntimeLog?;
    private previousRuntimeError?;
    private seq;
    start(): void;
    stop(): void;
    sendChat(opts: ChatSendOptions): Promise<{
        runId: string;
    }>;
    abortChat(opts: {
        sessionKey: string;
        runId: string;
    }): Promise<{
        ok: boolean;
        aborted: boolean;
    }>;
    loadHistory(opts: {
        sessionKey: string;
        limit?: number;
    }): Promise<{
        sessionKey: string;
        sessionId: string | undefined;
        messages: unknown[];
        thinkingLevel: string;
        fastMode: boolean | undefined;
        verboseLevel: string | undefined;
    }>;
    listSessions(opts?: Parameters<TuiBackend["listSessions"]>[0]): Promise<TuiSessionList>;
    listAgents(): Promise<TuiAgentsList>;
    patchSession(opts: Parameters<TuiBackend["patchSession"]>[0]): Promise<SessionsPatchResult>;
    resetSession(key: string, reason?: "new" | "reset"): Promise<{
        ok: boolean;
        key: string;
        entry: import("../config/sessions.js").SessionEntry;
    }>;
    getGatewayStatus(): Promise<string>;
    listModels(): Promise<TuiModelChoice[]>;
    listTools(opts: {
        agentId: string;
        includePlugins?: boolean;
    }): Promise<{
        agentId: string;
        profiles: {
            id: "coding" | "full" | "messaging" | "minimal";
            label: string;
        }[];
        groups: {
            id: string;
            label: string;
            source: "core" | "plugin";
            pluginId?: string | undefined;
            tools: {
                id: string;
                label: string;
                description: string;
                source: "core" | "plugin";
                pluginId?: string | undefined;
                optional?: boolean | undefined;
                defaultProfiles: ("coding" | "full" | "messaging" | "minimal")[];
            }[];
        }[];
    }>;
    listSkills(opts: {
        agentId: string;
    }): Promise<SkillStatusReport>;
    private abortSessionRuns;
    private nextSeq;
    private emit;
    private emitChatDelta;
    private emitChatFinal;
    private emitChatAborted;
    private emitChatError;
    private ensureRunRegistered;
    private handleAgentEvent;
    private runTurn;
}
