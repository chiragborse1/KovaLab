import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  describeHttpMcpServerLaunchConfig,
  resolveHttpMcpServerLaunchConfig,
  type HttpMcpTransportType,
} from "../agents/mcp-http.js";
import {
  resolveStdioMcpServerLaunchConfig,
  type StdioMcpServerLaunchConfig,
} from "../agents/mcp-stdio.js";
import {
  resolveKovaMcpTransportAlias,
  type ConfigMcpServers,
} from "../config/mcp-config-normalize.js";
import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";
import { isRecord } from "../utils.js";

type McpStatus = "ok" | "invalid";
type McpTransportStatus = "stdio" | HttpMcpTransportType | "unknown";
type McpProbeStatus = "ok" | "failed" | "skipped";

export type McpServerProbeResult = {
  status: McpProbeStatus;
  detail: string;
};

export type McpServerStatusEntry = {
  name: string;
  status: McpStatus;
  transport: McpTransportStatus;
  target: string | null;
  issues: string[];
  warnings: string[];
  argsCount?: number;
  envCount?: number;
  headerCount?: number;
  connectionTimeoutMs?: number;
  probe?: McpServerProbeResult;
  consumer: string;
};

export type McpServerStatusReport = {
  path: string;
  count: number;
  okCount: number;
  invalidCount: number;
  servers: McpServerStatusEntry[];
};

function readPositiveTimeoutMs(server: Record<string, unknown>): number | undefined {
  return typeof server.connectionTimeoutMs === "number" &&
    Number.isFinite(server.connectionTimeoutMs) &&
    server.connectionTimeoutMs > 0
    ? server.connectionTimeoutMs
    : undefined;
}

function getProbeTimeoutMs(server: Record<string, unknown>): number {
  return Math.min(readPositiveTimeoutMs(server) ?? 5_000, 10_000);
}

function readStringArrayLength(value: unknown): number | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((entry): entry is string => typeof entry === "string").length;
}

function readRecordSize(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const size = Object.keys(value).length;
  return size > 0 ? size : undefined;
}

function readRequestedTransport(server: Record<string, unknown>): string {
  if (typeof server.transport === "string") {
    return normalizeLowercaseStringOrEmpty(server.transport);
  }
  return resolveKovaMcpTransportAlias(server.type) ?? "";
}

function formatStdioTarget(config: StdioMcpServerLaunchConfig): string {
  const parts = [`command=${config.command}`];
  if (config.args && config.args.length > 0) {
    parts.push(`args=${config.args.length}`);
  }
  if (config.cwd) {
    parts.push(`cwd=set`);
  }
  return parts.join(" ");
}

function buildStdioStatus(
  name: string,
  server: Record<string, unknown>,
): McpServerStatusEntry | null {
  const droppedEnvKeys: string[] = [];
  const launch = resolveStdioMcpServerLaunchConfig(server, {
    onDroppedEnv: (key) => droppedEnvKeys.push(key),
  });
  if (!launch.ok) {
    return null;
  }
  const warnings: string[] = [];
  if (typeof server.url === "string" && server.url.trim().length > 0) {
    warnings.push("has both command and url; runtime uses the stdio command");
  }
  const requestedTransport = readRequestedTransport(server);
  if (requestedTransport && requestedTransport !== "stdio") {
    warnings.push(`transport "${requestedTransport}" is ignored for stdio command config`);
  }
  if (droppedEnvKeys.length > 0) {
    warnings.push(`blocked stdio env entries: ${droppedEnvKeys.length}`);
  }
  return {
    name,
    status: "ok",
    transport: "stdio",
    target: formatStdioTarget(launch.config),
    issues: [],
    warnings,
    argsCount: readStringArrayLength(server.args),
    envCount: readRecordSize(server.env),
    connectionTimeoutMs: readPositiveTimeoutMs(server),
    consumer: "runtime adapters",
  };
}

function buildHttpStatus(name: string, server: Record<string, unknown>): McpServerStatusEntry {
  const requestedTransport = readRequestedTransport(server);
  if (
    requestedTransport &&
    requestedTransport !== "sse" &&
    requestedTransport !== "streamable-http"
  ) {
    return {
      name,
      status: "invalid",
      transport: "unknown",
      target: null,
      issues: [`unsupported transport "${requestedTransport}"`],
      warnings: [],
      connectionTimeoutMs: readPositiveTimeoutMs(server),
      consumer: "runtime adapters",
    };
  }

  const transportType: HttpMcpTransportType =
    requestedTransport === "streamable-http" ? "streamable-http" : "sse";
  const droppedHeaderKeys: string[] = [];
  const warnings: string[] = [];
  const launch = resolveHttpMcpServerLaunchConfig(server, {
    transportType,
    onDroppedHeader: (key) => droppedHeaderKeys.push(key),
    onMalformedHeaders: () => warnings.push("headers must be an object"),
  });
  if (!launch.ok) {
    return {
      name,
      status: "invalid",
      transport:
        requestedTransport === "sse" || requestedTransport === "streamable-http"
          ? requestedTransport
          : "unknown",
      target: null,
      issues: [launch.reason],
      warnings,
      connectionTimeoutMs: readPositiveTimeoutMs(server),
      consumer: "runtime adapters",
    };
  }
  if (droppedHeaderKeys.length > 0) {
    warnings.push(`ignored non-string header entries: ${droppedHeaderKeys.length}`);
  }
  return {
    name,
    status: "ok",
    transport: launch.config.transportType,
    target: describeHttpMcpServerLaunchConfig(launch.config),
    issues: [],
    warnings,
    headerCount: readRecordSize(server.headers),
    connectionTimeoutMs: readPositiveTimeoutMs(server),
    consumer: "runtime adapters",
  };
}

export function buildMcpServerStatusEntry(
  name: string,
  server: Record<string, unknown>,
): McpServerStatusEntry {
  const stdioStatus = buildStdioStatus(name, server);
  if (stdioStatus) {
    return stdioStatus;
  }
  return buildHttpStatus(name, server);
}

export function buildMcpServerStatusReport(params: {
  path: string;
  mcpServers: ConfigMcpServers;
  name?: string;
}): McpServerStatusReport {
  const entries = Object.entries(params.mcpServers)
    .filter(([name]) => !params.name || name === params.name)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, server]) => buildMcpServerStatusEntry(name, server));
  const invalidCount = entries.filter((entry) => entry.status === "invalid").length;
  return {
    path: params.path,
    count: entries.length,
    okCount: entries.length - invalidCount,
    invalidCount,
    servers: entries,
  };
}

function commandHasPathSeparator(command: string): boolean {
  return command.includes("/") || command.includes("\\") || path.isAbsolute(command);
}

function getCommandPathCandidates(command: string): string[] {
  if (commandHasPathSeparator(command)) {
    return [command];
  }
  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter((entry) => entry.length > 0);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
          .split(";")
          .filter((entry) => entry.length > 0)
      : [""];
  return pathEntries.flatMap((entry) =>
    extensions.map((extension) => path.join(entry, command + extension)),
  );
}

async function canAccessExecutable(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate, process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function probeStdioServer(server: Record<string, unknown>): Promise<McpServerProbeResult> {
  const launch = resolveStdioMcpServerLaunchConfig(server);
  if (!launch.ok) {
    return { status: "skipped", detail: "not a stdio server" };
  }
  const checks = await Promise.all(
    getCommandPathCandidates(launch.config.command).map((candidate) =>
      canAccessExecutable(candidate),
    ),
  );
  const found = checks.some((value) => value);
  return found
    ? { status: "ok", detail: "command found" }
    : { status: "failed", detail: "command not found" };
}

async function probeHttpServer(server: Record<string, unknown>): Promise<McpServerProbeResult> {
  const requestedTransport = readRequestedTransport(server);
  const transportType: HttpMcpTransportType =
    requestedTransport === "streamable-http" ? "streamable-http" : "sse";
  const launch = resolveHttpMcpServerLaunchConfig(server, { transportType });
  if (!launch.ok) {
    return { status: "skipped", detail: launch.reason };
  }
  const timeoutMs = getProbeTimeoutMs(server);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(launch.config.url, {
      method: "GET",
      headers: {
        ...launch.config.headers,
        accept:
          launch.config.transportType === "sse"
            ? "text/event-stream"
            : "application/json, text/event-stream",
      },
      signal: controller.signal,
    });
    await response.body?.cancel().catch(() => undefined);
    if (response.status >= 500) {
      return { status: "failed", detail: `HTTP ${response.status}` };
    }
    return { status: "ok", detail: `HTTP ${response.status}` };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return { status: "failed", detail: message || "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function probeMcpServer(
  entry: McpServerStatusEntry,
  server: Record<string, unknown> | undefined,
): Promise<McpServerProbeResult> {
  if (!server || entry.status !== "ok") {
    return { status: "skipped", detail: "config invalid" };
  }
  if (entry.transport === "stdio") {
    return probeStdioServer(server);
  }
  if (entry.transport === "sse" || entry.transport === "streamable-http") {
    return probeHttpServer(server);
  }
  return { status: "skipped", detail: "unsupported transport" };
}

export async function probeMcpServerStatusReport(params: {
  report: McpServerStatusReport;
  mcpServers: ConfigMcpServers;
}): Promise<McpServerStatusReport> {
  const servers = await Promise.all(
    params.report.servers.map(async (entry) => ({
      ...entry,
      probe: await probeMcpServer(entry, params.mcpServers[entry.name]),
    })),
  );
  return {
    ...params.report,
    servers,
  };
}

export function formatMcpServerStatusReport(report: McpServerStatusReport): string[] {
  const lines = [`MCP saved-server status (${report.path}):`];
  if (report.servers.length === 0) {
    lines.push("- no saved MCP servers configured");
    return lines;
  }
  for (const entry of report.servers) {
    const suffix = entry.target ? ` ${entry.target}` : "";
    lines.push(`- ${entry.name}: ${entry.status} ${entry.transport}${suffix}`);
    if (entry.connectionTimeoutMs) {
      lines.push(`  timeout: ${entry.connectionTimeoutMs}ms`);
    }
    if (entry.envCount && entry.envCount > 0) {
      lines.push(`  env entries: ${entry.envCount}`);
    }
    if (entry.headerCount && entry.headerCount > 0) {
      lines.push(`  header entries: ${entry.headerCount}`);
    }
    if (entry.probe) {
      lines.push(`  probe: ${entry.probe.status} ${entry.probe.detail}`);
    }
    for (const warning of entry.warnings) {
      lines.push(`  warning: ${warning}`);
    }
    for (const issue of entry.issues) {
      lines.push(`  issue: ${issue}`);
    }
  }
  lines.push(`Summary: ${report.okCount} ok, ${report.invalidCount} invalid`);
  return lines;
}
