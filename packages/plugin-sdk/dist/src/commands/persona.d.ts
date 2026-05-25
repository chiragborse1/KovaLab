import type { KovaConfig } from "../config/types.kova.js";
import type { RuntimeEnv } from "../runtime.js";
export type PersonaActionOptions = {
    agent?: string;
    workspace?: string;
    json?: boolean;
};
export type PersonaShowOptions = PersonaActionOptions & {
    all?: boolean;
    lines?: number;
};
export type PersonaInitOptions = PersonaActionOptions & {
    force?: boolean;
};
export type PersonaEditOptions = PersonaInitOptions & {
    editor?: string;
    printPath?: boolean;
};
export type PersonaTarget = {
    agentId: string;
    workspaceDir: string;
    personaPath: string;
};
export type PersonaFileStatus = PersonaTarget & {
    found: boolean;
    bytes?: number;
    lineCount?: number;
    updatedAtMs?: number;
    error?: string;
};
export type PersonaFileContent = PersonaFileStatus & {
    content?: string;
};
export declare function resolvePersonaTarget(params: {
    cfg: KovaConfig;
    agent?: string;
    workspace?: string;
}): PersonaTarget;
export declare function resolvePersonaStatus(params: {
    cfg: KovaConfig;
    agent?: string;
    workspace?: string;
}): Promise<PersonaFileStatus>;
export declare function resolvePersonaContent(params: {
    cfg: KovaConfig;
    agent?: string;
    workspace?: string;
}): Promise<PersonaFileContent>;
export declare function formatPersonaStatus(status: PersonaFileStatus): string;
export declare function formatPersonaContent(file: PersonaFileContent, opts: PersonaShowOptions): string;
export declare function personaStatusCommand(opts: PersonaActionOptions, runtime?: RuntimeEnv): Promise<void>;
export declare function personaPathCommand(opts: PersonaActionOptions, runtime?: RuntimeEnv): Promise<void>;
export declare function personaShowCommand(opts: PersonaShowOptions, runtime?: RuntimeEnv): Promise<void>;
export declare function personaInitCommand(opts: PersonaInitOptions, runtime?: RuntimeEnv): Promise<void>;
export declare function personaEditCommand(opts: PersonaEditOptions, runtime?: RuntimeEnv): Promise<void>;
