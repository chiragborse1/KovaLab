import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { DEFAULT_SOUL_FILENAME, loadWorkspaceBootstrapTemplate } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import type { KovaConfig } from "../config/types.kova.js";
import { openBoundaryFile } from "../infra/boundary-file-read.js";
import { normalizeAgentId } from "../routing/session-key.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime, writeRuntimeJson } from "../runtime.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { resolveUserPath, shortenHomePath } from "../utils.js";
import { requireValidConfig } from "./agents.command-shared.js";

const DEFAULT_PERSONA_SHOW_LINES = 120;
const MAX_PERSONA_SHOW_LINES = 240;
const MAX_PERSONA_FILE_BYTES = 512 * 1024;

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

type PersonaWriteResult = PersonaTarget & {
  created: boolean;
  overwritten: boolean;
  backupPath?: string;
};

function resolveAgentId(cfg: KovaConfig, raw?: string): string {
  return normalizeAgentId(normalizeOptionalString(raw) ?? resolveDefaultAgentId(cfg));
}

export function resolvePersonaTarget(params: {
  cfg: KovaConfig;
  agent?: string;
  workspace?: string;
}): PersonaTarget {
  const agentId = resolveAgentId(params.cfg, params.agent);
  const workspaceDir = path.resolve(
    resolveUserPath(
      normalizeOptionalString(params.workspace) ?? resolveAgentWorkspaceDir(params.cfg, agentId),
    ),
  );
  return {
    agentId,
    workspaceDir,
    personaPath: path.join(workspaceDir, DEFAULT_SOUL_FILENAME),
  };
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r?\n/).length;
}

async function readPersonaFile(target: PersonaTarget): Promise<PersonaFileContent> {
  const opened = await openBoundaryFile({
    absolutePath: target.personaPath,
    rootPath: target.workspaceDir,
    boundaryLabel: "workspace root",
    maxBytes: MAX_PERSONA_FILE_BYTES,
    allowedType: "file",
  });
  if (!opened.ok) {
    const code = (opened.error as NodeJS.ErrnoException | undefined)?.code;
    return {
      ...target,
      found: false,
      error:
        opened.reason === "path" ? "not found" : code ? `${opened.reason}: ${code}` : opened.reason,
    };
  }

  try {
    const content = fsSync.readFileSync(opened.fd, "utf-8");
    return {
      ...target,
      found: true,
      bytes: Buffer.byteLength(content),
      lineCount: countLines(content),
      updatedAtMs: Math.floor(opened.stat.mtimeMs),
      content,
    };
  } finally {
    fsSync.closeSync(opened.fd);
  }
}

export async function resolvePersonaStatus(params: {
  cfg: KovaConfig;
  agent?: string;
  workspace?: string;
}): Promise<PersonaFileStatus> {
  const target = resolvePersonaTarget(params);
  const file = await readPersonaFile(target);
  const { content: _content, ...status } = file;
  return status;
}

export async function resolvePersonaContent(params: {
  cfg: KovaConfig;
  agent?: string;
  workspace?: string;
}): Promise<PersonaFileContent> {
  return await readPersonaFile(resolvePersonaTarget(params));
}

function clampLines(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PERSONA_SHOW_LINES;
  }
  return Math.min(MAX_PERSONA_SHOW_LINES, Math.max(1, Math.floor(value)));
}

function slicePersonaContent(
  content: string,
  opts: PersonaShowOptions,
): {
  content: string;
  shownLineCount: number;
  lineCount: number;
  truncated: boolean;
} {
  const lines = content.split(/\r?\n/);
  const lineCount = content.length === 0 ? 0 : lines.length;
  if (opts.all || lineCount <= clampLines(opts.lines)) {
    return {
      content,
      shownLineCount: lineCount,
      lineCount,
      truncated: false,
    };
  }
  const limit = clampLines(opts.lines);
  return {
    content: lines.slice(0, limit).join("\n"),
    shownLineCount: limit,
    lineCount,
    truncated: true,
  };
}

export function formatPersonaStatus(status: PersonaFileStatus): string {
  const lines = [
    `Persona status (${status.agentId})`,
    `File: ${shortenHomePath(status.personaPath)}`,
    `Workspace: ${shortenHomePath(status.workspaceDir)}`,
    `State: ${status.found ? "ready" : "missing"}`,
  ];
  if (status.found) {
    lines.push(`Lines: ${String(status.lineCount ?? 0)}`);
    lines.push(`Bytes: ${String(status.bytes ?? 0)}`);
    if (status.updatedAtMs) {
      lines.push(`Updated: ${new Date(status.updatedAtMs).toISOString()}`);
    }
  } else if (status.error) {
    lines.push(`Reason: ${status.error}`);
    lines.push(`Create it: ${formatCliCommand(`kova persona init --agent ${status.agentId}`)}`);
  }
  lines.push(`Edit: ${formatCliCommand(`kova persona edit --agent ${status.agentId}`)}`);
  lines.push(`Show: ${formatCliCommand(`kova persona show --agent ${status.agentId}`)}`);
  return lines.join("\n");
}

export function formatPersonaContent(file: PersonaFileContent, opts: PersonaShowOptions): string {
  if (!file.found || file.content === undefined) {
    return [
      `Persona file not found (${file.agentId}).`,
      `Expected: ${shortenHomePath(file.personaPath)}`,
      `Create it: ${formatCliCommand(`kova persona init --agent ${file.agentId}`)}`,
    ].join("\n");
  }

  const display = slicePersonaContent(file.content, opts);
  const showing = display.truncated
    ? `first ${String(display.shownLineCount)} of ${String(display.lineCount)} lines`
    : `${String(display.lineCount)} line${display.lineCount === 1 ? "" : "s"}`;
  const parts = [
    `Persona (${file.agentId}): ${DEFAULT_SOUL_FILENAME}`,
    `Workspace: ${shortenHomePath(file.workspaceDir)}`,
    `Showing: ${showing}`,
    "",
    display.content.trimEnd() || "(empty)",
  ];
  if (display.truncated) {
    parts.push(
      "",
      `Continue with: ${formatCliCommand(`kova persona show --agent ${file.agentId} --all`)}`,
    );
  }
  return parts.join("\n");
}

function buildBackupStamp(now = new Date()): string {
  return now.toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

async function writePersonaTemplate(
  target: PersonaTarget,
  opts: PersonaInitOptions,
): Promise<PersonaWriteResult> {
  await fs.mkdir(target.workspaceDir, { recursive: true });
  const template = await loadWorkspaceBootstrapTemplate(DEFAULT_SOUL_FILENAME);
  if (!opts.force) {
    try {
      await fs.writeFile(target.personaPath, template, { encoding: "utf-8", flag: "wx" });
      return { ...target, created: true, overwritten: false };
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code !== "EEXIST") {
        throw error;
      }
      return { ...target, created: false, overwritten: false };
    }
  }

  let backupPath: string | undefined;
  try {
    await fs.access(target.personaPath);
    backupPath = path.join(
      target.workspaceDir,
      `${DEFAULT_SOUL_FILENAME}.bak-${buildBackupStamp()}`,
    );
    await fs.copyFile(target.personaPath, backupPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
      throw error;
    }
  }
  await fs.writeFile(target.personaPath, template, "utf-8");
  return {
    ...target,
    created: backupPath === undefined,
    overwritten: backupPath !== undefined,
    backupPath,
  };
}

function formatPersonaInitResult(result: PersonaWriteResult): string {
  if (result.created) {
    return [
      `Created ${shortenHomePath(result.personaPath)}.`,
      `Edit it: ${formatCliCommand(`kova persona edit --agent ${result.agentId}`)}`,
    ].join("\n");
  }
  if (result.overwritten) {
    return [
      `Reset ${shortenHomePath(result.personaPath)} from the default template.`,
      result.backupPath ? `Backup: ${shortenHomePath(result.backupPath)}` : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");
  }
  return [
    `Persona file already exists: ${shortenHomePath(result.personaPath)}`,
    `Show it: ${formatCliCommand(`kova persona show --agent ${result.agentId}`)}`,
    `Reset with a backup: ${formatCliCommand(`kova persona init --agent ${result.agentId} --force`)}`,
  ].join("\n");
}

async function loadConfigForPersona(runtime: RuntimeEnv): Promise<KovaConfig | null> {
  return await requireValidConfig(runtime);
}

async function loadPersonaTarget(
  opts: PersonaActionOptions,
  runtime: RuntimeEnv,
): Promise<{ cfg: KovaConfig; target: PersonaTarget } | null> {
  const cfg = await loadConfigForPersona(runtime);
  if (!cfg) {
    return null;
  }
  return {
    cfg,
    target: resolvePersonaTarget({ cfg, agent: opts.agent, workspace: opts.workspace }),
  };
}

export async function personaStatusCommand(
  opts: PersonaActionOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const loaded = await loadPersonaTarget(opts, runtime);
  if (!loaded) {
    return;
  }
  const status = await resolvePersonaStatus({
    cfg: loaded.cfg,
    agent: loaded.target.agentId,
    workspace: loaded.target.workspaceDir,
  });
  if (opts.json) {
    writeRuntimeJson(runtime, status);
    return;
  }
  runtime.log(formatPersonaStatus(status));
}

export async function personaPathCommand(
  opts: PersonaActionOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const loaded = await loadPersonaTarget(opts, runtime);
  if (!loaded) {
    return;
  }
  if (opts.json) {
    writeRuntimeJson(runtime, loaded.target);
    return;
  }
  runtime.log(shortenHomePath(loaded.target.personaPath));
}

export async function personaShowCommand(
  opts: PersonaShowOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const loaded = await loadPersonaTarget(opts, runtime);
  if (!loaded) {
    return;
  }
  const file = await resolvePersonaContent({
    cfg: loaded.cfg,
    agent: loaded.target.agentId,
    workspace: loaded.target.workspaceDir,
  });
  if (opts.json) {
    const display =
      file.content === undefined ? undefined : slicePersonaContent(file.content, opts);
    writeRuntimeJson(runtime, {
      ...file,
      ...(display
        ? {
            shownLineCount: display.shownLineCount,
            truncated: display.truncated,
            content: display.content,
          }
        : {}),
    });
    return;
  }
  runtime.log(formatPersonaContent(file, opts));
}

export async function personaInitCommand(
  opts: PersonaInitOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const loaded = await loadPersonaTarget(opts, runtime);
  if (!loaded) {
    return;
  }
  const result = await writePersonaTemplate(loaded.target, opts);
  if (opts.json) {
    writeRuntimeJson(runtime, result);
    return;
  }
  runtime.log(formatPersonaInitResult(result));
}

function resolveEditor(opts: PersonaEditOptions): string | undefined {
  return (
    normalizeOptionalString(opts.editor) ??
    normalizeOptionalString(process.env.VISUAL) ??
    normalizeOptionalString(process.env.EDITOR)
  );
}

function canOpenInteractiveEditor(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

function quoteShellArg(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function spawnEditor(command: string, filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(`${command} ${quoteShellArg(filePath)}`, {
      stdio: "inherit",
      shell: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 0));
  });
}

export async function personaEditCommand(
  opts: PersonaEditOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const loaded = await loadPersonaTarget(opts, runtime);
  if (!loaded) {
    return;
  }
  const init = await writePersonaTemplate(loaded.target, { ...opts, force: false });
  const editor = resolveEditor(opts);
  const nonInteractive = !canOpenInteractiveEditor();
  if (opts.printPath || !editor || nonInteractive) {
    const result = {
      ...init,
      opened: false,
      reason: opts.printPath ? "print_path" : !editor ? "no_editor" : "non_interactive",
    };
    if (opts.json) {
      writeRuntimeJson(runtime, result);
      return;
    }
    runtime.log(shortenHomePath(loaded.target.personaPath));
    if (!opts.printPath) {
      runtime.log(
        !editor
          ? "Set EDITOR or VISUAL to open this file from the terminal."
          : "Run this command from an interactive terminal to open your editor.",
      );
    }
    return;
  }

  const code = await spawnEditor(editor, loaded.target.personaPath);
  if (opts.json) {
    writeRuntimeJson(runtime, {
      ...init,
      opened: code === 0,
      exitCode: code,
      editor,
    });
    return;
  }
  if (code !== 0) {
    runtime.error(`Editor exited with code ${String(code)}.`);
    runtime.exit(code);
  }
}
