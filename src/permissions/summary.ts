import type { KovaConfig } from "../config/types.kova.js";
import { collectExecPolicyScopeSnapshots } from "../infra/exec-approvals-effective.js";
import type { ExecApprovalsFile } from "../infra/exec-approvals.js";
import { sanitizeTerminalText } from "../terminal/safe-text.js";

type PermissionSummaryRuntime = {
  tools?: {
    count: number;
    groups: number;
  };
  plugins?: {
    total: number;
    enabled: number;
    errors: number;
  };
};

type PermissionSummaryApprovals = {
  path: string;
  exists: boolean;
  file: ExecApprovalsFile;
};

export type PermissionSummaryInput = {
  cfg: KovaConfig;
  configPath?: string | null;
  approvals?: PermissionSummaryApprovals | null;
  runtime?: PermissionSummaryRuntime;
};

function text(value: unknown): string {
  if (typeof value === "string") {
    return sanitizeTerminalText(value);
  }
  if (value === undefined || value === null) {
    return "";
  }
  return sanitizeTerminalText(String(value));
}

function summarizeList(values: readonly string[] | undefined, empty: string): string {
  const cleaned = (values ?? [])
    .map((value) => text(value).trim())
    .filter((value) => value.length > 0);
  if (cleaned.length === 0) {
    return empty;
  }
  const visible = cleaned.slice(0, 8);
  const suffix =
    cleaned.length > visible.length ? `, +${cleaned.length - visible.length} more` : "";
  return `${visible.join(", ")}${suffix}`;
}

function summarizeBoolean(value: boolean | undefined, defaultText: string): string {
  if (value === true) {
    return "on";
  }
  if (value === false) {
    return "off";
  }
  return defaultText;
}

function summarizePluginEntries(cfg: KovaConfig): { configured: number; enabled: number } {
  const entries = Object.values(cfg.plugins?.entries ?? {});
  return {
    configured: entries.length,
    enabled: entries.filter((entry) => entry?.enabled !== false).length,
  };
}

function formatExecPolicyLines(params: PermissionSummaryInput): string[] {
  const toolsExec = params.cfg.tools?.exec;
  const lines = [
    `- requested: host ${text(toolsExec?.host ?? "auto")} · security ${text(
      toolsExec?.security ?? "full",
    )} · ask ${text(toolsExec?.ask ?? "off")}`,
  ];
  if (!params.approvals) {
    lines.push("- effective: run `kova exec-policy show` for host approvals merge");
    return lines;
  }
  const scopes = collectExecPolicyScopeSnapshots({
    cfg: params.cfg,
    approvals: params.approvals.file,
    hostPath: params.approvals.path,
  });
  lines.push(
    `- approvals: ${params.approvals.exists ? "present" : "missing"} (${text(
      params.approvals.path,
    )})`,
  );
  for (const scope of scopes.slice(0, 4)) {
    lines.push(
      `- ${text(scope.scopeLabel)}: host ${text(scope.host.requested)} · security ${text(
        scope.security.effective,
      )} · ask ${text(scope.ask.effective)} · fallback ${text(scope.askFallback.effective)}`,
    );
  }
  if (scopes.length > 4) {
    lines.push(`- +${scopes.length - 4} more agent policy scope${scopes.length === 5 ? "" : "s"}`);
  }
  return lines;
}

export function formatPermissionSummary(params: PermissionSummaryInput): string {
  const cfg = params.cfg;
  const toolProfile = cfg.tools?.profile ?? "full";
  const configuredPlugins = summarizePluginEntries(cfg);
  const globalSandbox = cfg.agents?.defaults?.sandbox;
  const agentOverrides = (cfg.agents?.list ?? []).filter(
    (agent) =>
      agent.tools !== undefined ||
      agent.sandbox !== undefined ||
      agent.runtime !== undefined ||
      agent.model !== undefined,
  );

  const lines = [
    "Kova permissions",
    `Config: ${text(params.configPath ?? "active runtime config")}`,
    "",
    "Tools",
    `- profile: ${text(toolProfile)}${cfg.tools?.profile ? "" : " (default)"}`,
    `- allow: ${summarizeList(cfg.tools?.allow, "not set")}`,
    `- also allow: ${summarizeList(cfg.tools?.alsoAllow, "not set")}`,
    `- deny: ${summarizeList(cfg.tools?.deny, "not set")}`,
    `- filesystem: ${cfg.tools?.fs?.workspaceOnly ? "workspace only" : "not workspace-limited"}`,
    `- elevated: ${summarizeBoolean(cfg.tools?.elevated?.enabled, "default on")}`,
  ];

  if (params.runtime?.tools) {
    lines.push(
      `- runtime: ${params.runtime.tools.count} tools across ${params.runtime.tools.groups} groups`,
    );
  }

  lines.push("", "Exec approvals", ...formatExecPolicyLines(params));
  lines.push(
    "",
    "Sandbox",
    `- mode: ${text(globalSandbox?.mode ?? "off")}`,
    `- backend: ${text(globalSandbox?.backend ?? "docker")}`,
    `- workspace: ${text(globalSandbox?.workspaceAccess ?? "default")}`,
    `- sandbox tool allow: ${summarizeList(cfg.tools?.sandbox?.tools?.allow, "not set")}`,
    `- sandbox tool deny: ${summarizeList(cfg.tools?.sandbox?.tools?.deny, "not set")}`,
  );

  lines.push(
    "",
    "Plugins",
    `- loading: ${cfg.plugins?.enabled === false ? "off" : "on"}`,
    `- allow: ${summarizeList(cfg.plugins?.allow, "not set")}`,
    `- deny: ${summarizeList(cfg.plugins?.deny, "not set")}`,
    `- entries: ${configuredPlugins.enabled}/${configuredPlugins.configured} enabled`,
  );
  if (params.runtime?.plugins) {
    lines.push(
      `- runtime: ${params.runtime.plugins.enabled}/${params.runtime.plugins.total} enabled, ${params.runtime.plugins.errors} errors`,
    );
  }

  lines.push(
    "",
    "Agent overrides",
    agentOverrides.length > 0
      ? `- ${agentOverrides.length} agent override${agentOverrides.length === 1 ? "" : "s"} configured`
      : "- none",
    "",
    "Change commands",
    "- Terminal session: `/permissions edit`, `/permissions preset balanced`, `/elevated ask`, `/approve`",
    "- Tool profiles: edit `tools.profile`, `tools.allow`, `tools.deny` in `kova settings` or `kova config`",
    "- Exec policy: `kova exec-policy show`, `kova exec-policy preset cautious`, `kova approvals get`",
    "- Sandbox: `kova sandbox explain`",
    "- Runtime catalog: `/tools verbose`, `/plugins verbose`",
  );

  return lines.join("\n");
}
