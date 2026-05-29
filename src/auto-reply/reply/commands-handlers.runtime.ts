import { handleAcpCommand } from "./commands-acp.js";
import { handleAllowlistCommand } from "./commands-allowlist.js";
import { handleApproveCommand } from "./commands-approve.js";
import { handleBashCommand } from "./commands-bash.js";
import { handleBtwCommand } from "./commands-btw.js";
import { handleCompactCommand } from "./commands-compact.js";
import { handleConfigCommand, handleDebugCommand } from "./commands-config.js";
import { handleContextCommand } from "./commands-context-command.js";
import { handleDiagnosticsCommand } from "./commands-diagnostics.js";
import {
  handleCommandsListCommand,
  handleExportTrajectoryCommand,
  handleExportSessionCommand,
  handleHelpCommand,
  handleSkillCommandUsage,
  handleStatusCommand,
  handleToolsCommand,
} from "./commands-info.js";
import { handleMcpCommand } from "./commands-mcp.js";
import { handleMemoryCommand } from "./commands-memory.js";
import { handleModelsCommand } from "./commands-models.js";
import { handlePersonaCommand } from "./commands-persona.js";
import { handlePluginCommand } from "./commands-plugin.js";
import { handlePluginsCommand } from "./commands-plugins.js";
import {
  handleAbortTrigger,
  handleActivationCommand,
  handleFastCommand,
  handleRestartCommand,
  handleSendPolicyCommand,
  handleSessionCommand,
  handleStopCommand,
  handleUsageCommand,
} from "./commands-session.js";
import { handleSubagentsCommand } from "./commands-subagents.js";
import { handleTasksCommand } from "./commands-tasks.js";
import { handleTtsCommands } from "./commands-tts.js";
import type { CommandHandler } from "./commands-types.js";
import { handleUpdateCommand } from "./commands-update.js";
import { handleWhoamiCommand } from "./commands-whoami.js";

export function loadCommandHandlers(): CommandHandler[] {
  return [
    handlePluginCommand,
    handleBtwCommand,
    handleBashCommand,
    handleActivationCommand,
    handleSendPolicyCommand,
    handleFastCommand,
    handleUsageCommand,
    handleSessionCommand,
    handleRestartCommand,
    handleUpdateCommand,
    handleTtsCommands,
    handleHelpCommand,
    handleCommandsListCommand,
    handleSkillCommandUsage,
    handleToolsCommand,
    handleMemoryCommand,
    handlePersonaCommand,
    handleStatusCommand,
    handleDiagnosticsCommand,
    handleTasksCommand,
    handleAllowlistCommand,
    handleApproveCommand,
    handleContextCommand,
    handleExportSessionCommand,
    handleExportTrajectoryCommand,
    handleWhoamiCommand,
    handleSubagentsCommand,
    handleAcpCommand,
    handleMcpCommand,
    handlePluginsCommand,
    handleConfigCommand,
    handleDebugCommand,
    handleModelsCommand,
    handleStopCommand,
    handleCompactCommand,
    handleAbortTrigger,
  ];
}
