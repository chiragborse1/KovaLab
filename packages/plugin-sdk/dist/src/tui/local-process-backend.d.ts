import type { ChatSendOptions, TuiAgentsList, TuiBackend, TuiEvent, TuiModelChoice, TuiSessionList } from "./tui-backend.js";
export declare class LocalProcessTuiBackend implements TuiBackend {
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
    private child;
    private stdoutBuffer;
    private stderrTail;
    private nextRequestId;
    private readonly pending;
    private disconnected;
    private connected;
    start(): void;
    stop(): void;
    sendChat(opts: ChatSendOptions): Promise<{
        runId: string;
    }>;
    steerChat(opts: {
        sessionKey: string;
        message: string;
    }): Promise<{
        ok: boolean;
        reason?: string;
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
    }): Promise<unknown>;
    listSessions(opts?: Parameters<TuiBackend["listSessions"]>[0]): Promise<TuiSessionList>;
    listAgents(): Promise<TuiAgentsList>;
    patchSession(opts: Parameters<TuiBackend["patchSession"]>[0]): Promise<import("../shared/session-types.ts").SessionsPatchResultBase<import("getkova/plugin-sdk/session-store-runtime").SessionEntry> & {
        entry: import("getkova/plugin-sdk/session-store-runtime").SessionEntry;
        resolved?: {
            modelProvider?: string;
            model?: string;
        };
    }>;
    resetSession(key: string, reason?: "new" | "reset"): Promise<unknown>;
    getGatewayStatus(): Promise<unknown>;
    listModels(): Promise<TuiModelChoice[]>;
    listCommands(opts?: Parameters<NonNullable<TuiBackend["listCommands"]>>[0]): Promise<{
        name: string;
        nativeName?: string | undefined;
        textAliases?: string[] | undefined;
        description: string;
        category?: "docks" | "management" | "media" | "options" | "session" | "status" | "tools" | undefined;
        source: "native" | "plugin" | "skill";
        scope: "both" | "native" | "text";
        acceptsArgs: boolean;
        args?: {
            name: string;
            description: string;
            type: "boolean" | "number" | "string";
            required?: boolean | undefined;
            choices?: {
                value: string;
                label: string;
            }[] | undefined;
            dynamic?: boolean | undefined;
        }[] | undefined;
    }[]>;
    listPlugins(): Promise<{
        registrySource: "derived" | "persisted" | "provided";
        plugins: {
            id: string;
            name: string;
            enabled: boolean;
            status: "disabled" | "error" | "loaded";
            origin: string;
            format?: string | undefined;
            bundleFormat?: string | undefined;
            kind?: string | string[] | undefined;
            version?: string | undefined;
            description?: string | undefined;
            channelIds: string[];
            providerIds: string[];
            toolNames: string[];
            gatewayMethods: string[];
            services: string[];
            commands: string[];
            configSchema: boolean;
            installed: boolean;
            configured: boolean;
            removable: boolean;
            error?: string | undefined;
        }[];
        diagnostics: {
            level: "error" | "info" | "warn";
            message: string;
            code?: string | undefined;
            pluginId?: string | undefined;
            source?: string | undefined;
        }[];
        totals: {
            total: number;
            enabled: number;
            disabled: number;
            errors: number;
            channels: number;
            providers: number;
        };
    }>;
    listTools(opts: Parameters<NonNullable<TuiBackend["listTools"]>>[0]): Promise<{
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
    listSkills(opts: Parameters<NonNullable<TuiBackend["listSkills"]>>[0]): Promise<import("../agents/skills-status.ts").SkillStatusReport>;
    listTasks(opts?: Parameters<NonNullable<TuiBackend["listTasks"]>>[0]): Promise<import("./tui-backend.js").TuiTasksList>;
    auditTasks(): Promise<import("./tui-backend.js").TuiTasksAudit>;
    maintainTasks(opts?: Parameters<NonNullable<TuiBackend["maintainTasks"]>>[0]): Promise<import("./tui-backend.js").TuiTasksMaintenance>;
    listSessionCheckpoints(opts: Parameters<NonNullable<TuiBackend["listSessionCheckpoints"]>>[0]): Promise<import("./tui-backend.js").TuiSessionCheckpointList>;
    getSessionCheckpoint(opts: Parameters<NonNullable<TuiBackend["getSessionCheckpoint"]>>[0]): Promise<import("./tui-backend.js").TuiSessionCheckpointResult>;
    branchSessionCheckpoint(opts: Parameters<NonNullable<TuiBackend["branchSessionCheckpoint"]>>[0]): Promise<import("./tui-backend.js").TuiSessionCheckpointBranch>;
    restoreSessionCheckpoint(opts: Parameters<NonNullable<TuiBackend["restoreSessionCheckpoint"]>>[0]): Promise<import("./tui-backend.js").TuiSessionCheckpointRestore>;
    private request;
    private write;
    private handleStdout;
    private handleMessage;
    private failAllPending;
    private emitDisconnected;
    private emitConnected;
}
