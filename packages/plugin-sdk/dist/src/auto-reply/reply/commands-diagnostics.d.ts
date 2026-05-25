import { createExecTool } from "../../agents/bash-tools.js";
import type { CommandHandler } from "./commands-types.js";
type DiagnosticsCommandDeps = {
    createExecTool: typeof createExecTool;
};
export declare function createDiagnosticsCommandHandler(deps?: Partial<DiagnosticsCommandDeps>): CommandHandler;
export declare const handleDiagnosticsCommand: CommandHandler;
export {};
