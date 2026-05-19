import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { hostname as readHostName } from "node:os";
import { z } from "zod";
import type { CodexSandboxPolicy, CodexServiceTier } from "./protocol.js";

const UNIX_CODEX_REQUIREMENTS_PATH = "/etc/codex/requirements.toml";
const WINDOWS_CODEX_REQUIREMENTS_SUFFIX = "\\OpenAI\\Codex\\requirements.toml";

export type CodexAppServerTransportMode = "stdio" | "websocket";
export type CodexAppServerPolicyMode = "yolo" | "guardian";
type CodexAppServerDefaultPolicy = {
  mode: CodexAppServerPolicyMode;
  approvalPolicy?: CodexAppServerApprovalPolicy;
  approvalsReviewer?: CodexAppServerApprovalsReviewer;
  sandbox?: CodexAppServerSandboxMode;
};
export type CodexAppServerApprovalPolicy = "never" | "on-request" | "on-failure" | "untrusted";
export type CodexAppServerSandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type CodexAppServerApprovalsReviewer = "user" | "auto_review" | "guardian_subagent";
export type CodexAppServerCommandSource = "managed" | "resolved-managed" | "config" | "env";

export type CodexComputerUseConfig = {
  enabled?: boolean;
  autoInstall?: boolean;
  marketplaceDiscoveryTimeoutMs?: number;
  marketplaceSource?: string;
  marketplacePath?: string;
  marketplaceName?: string;
  pluginName?: string;
  mcpServerName?: string;
};

export type ResolvedCodexComputerUseConfig = {
  enabled: boolean;
  autoInstall: boolean;
  marketplaceDiscoveryTimeoutMs: number;
  pluginName: string;
  mcpServerName: string;
  marketplaceSource?: string;
  marketplacePath?: string;
  marketplaceName?: string;
};

export type CodexAppServerStartOptions = {
  transport: CodexAppServerTransportMode;
  command: string;
  commandSource?: CodexAppServerCommandSource;
  args: string[];
  url?: string;
  authToken?: string;
  headers: Record<string, string>;
  env?: Record<string, string>;
  clearEnv?: string[];
};

export type CodexAppServerRuntimeOptions = {
  start: CodexAppServerStartOptions;
  requestTimeoutMs: number;
  approvalPolicy: CodexAppServerApprovalPolicy;
  sandbox: CodexAppServerSandboxMode;
  approvalsReviewer: CodexAppServerApprovalsReviewer;
  serviceTier?: CodexServiceTier;
};

export type CodexPluginConfig = {
  codexDynamicToolsExclude?: string[];
  discovery?: {
    enabled?: boolean;
    timeoutMs?: number;
  };
  computerUse?: CodexComputerUseConfig;
  appServer?: {
    mode?: CodexAppServerPolicyMode;
    transport?: CodexAppServerTransportMode;
    command?: string;
    args?: string[] | string;
    url?: string;
    authToken?: string;
    headers?: Record<string, string>;
    requestTimeoutMs?: number;
    approvalPolicy?: CodexAppServerApprovalPolicy;
    sandbox?: CodexAppServerSandboxMode;
    approvalsReviewer?: CodexAppServerApprovalsReviewer;
    serviceTier?: CodexServiceTier | null;
    defaultWorkspaceDir?: string;
  };
};

export const CODEX_APP_SERVER_CONFIG_KEYS = [
  "mode",
  "transport",
  "command",
  "args",
  "url",
  "authToken",
  "headers",
  "requestTimeoutMs",
  "approvalPolicy",
  "sandbox",
  "approvalsReviewer",
  "serviceTier",
  "defaultWorkspaceDir",
] as const;

export const CODEX_COMPUTER_USE_CONFIG_KEYS = [
  "enabled",
  "autoInstall",
  "marketplaceDiscoveryTimeoutMs",
  "marketplaceSource",
  "marketplacePath",
  "marketplaceName",
  "pluginName",
  "mcpServerName",
] as const;

export const DEFAULT_CODEX_COMPUTER_USE_PLUGIN_NAME = "computer-use";
export const DEFAULT_CODEX_COMPUTER_USE_MCP_SERVER_NAME = "computer-use";
export const DEFAULT_CODEX_COMPUTER_USE_MARKETPLACE_DISCOVERY_TIMEOUT_MS = 60_000;

const codexAppServerTransportSchema = z.enum(["stdio", "websocket"]);
const codexAppServerPolicyModeSchema = z.enum(["yolo", "guardian"]);
const codexAppServerApprovalPolicySchema = z.enum([
  "never",
  "on-request",
  "on-failure",
  "untrusted",
]);
const codexAppServerSandboxSchema = z.enum(["read-only", "workspace-write", "danger-full-access"]);
const codexAppServerApprovalsReviewerSchema = z.enum(["user", "auto_review", "guardian_subagent"]);
const codexAppServerServiceTierSchema = z.preprocess(
  (value) => (value === null ? null : resolveServiceTier(value)),
  z.enum(["fast", "flex"]).nullable().optional(),
);

const codexPluginConfigSchema = z
  .object({
    codexDynamicToolsExclude: z.array(z.string()).optional(),
    discovery: z
      .object({
        enabled: z.boolean().optional(),
        timeoutMs: z.number().positive().optional(),
      })
      .strict()
      .optional(),
    computerUse: z
      .object({
        enabled: z.boolean().optional(),
        autoInstall: z.boolean().optional(),
        marketplaceDiscoveryTimeoutMs: z.number().positive().optional(),
        marketplaceSource: z.string().optional(),
        marketplacePath: z.string().optional(),
        marketplaceName: z.string().optional(),
        pluginName: z.string().optional(),
        mcpServerName: z.string().optional(),
      })
      .strict()
      .optional(),
    appServer: z
      .object({
        mode: codexAppServerPolicyModeSchema.optional(),
        transport: codexAppServerTransportSchema.optional(),
        command: z.string().optional(),
        args: z.union([z.array(z.string()), z.string()]).optional(),
        url: z.string().optional(),
        authToken: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
        requestTimeoutMs: z.number().positive().optional(),
        approvalPolicy: codexAppServerApprovalPolicySchema.optional(),
        sandbox: codexAppServerSandboxSchema.optional(),
        approvalsReviewer: codexAppServerApprovalsReviewerSchema.optional(),
        serviceTier: codexAppServerServiceTierSchema,
        defaultWorkspaceDir: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function readCodexPluginConfig(value: unknown): CodexPluginConfig {
  const parsed = codexPluginConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export function resolveCodexAppServerRuntimeOptions(
  params: {
    pluginConfig?: unknown;
    env?: NodeJS.ProcessEnv;
    requirementsToml?: string | null;
    requirementsPath?: string;
    readRequirementsFile?: (path: string) => string | undefined;
    platform?: NodeJS.Platform;
    hostName?: string;
  } = {},
): CodexAppServerRuntimeOptions {
  const env = params.env ?? process.env;
  const config = readCodexPluginConfig(params.pluginConfig).appServer ?? {};
  const transport = resolveTransport(config.transport);
  const configCommand = readNonEmptyString(config.command);
  const envCommand = readNonEmptyString(env.KOVA_CODEX_APP_SERVER_BIN);
  const command = configCommand ?? envCommand ?? "codex";
  const commandSource: CodexAppServerCommandSource = configCommand
    ? "config"
    : envCommand
      ? "env"
      : "managed";
  const args = resolveArgs(config.args, env.KOVA_CODEX_APP_SERVER_ARGS);
  const headers = normalizeHeaders(config.headers);
  const authToken = readNonEmptyString(config.authToken);
  const url = readNonEmptyString(config.url);
  const explicitPolicyMode =
    resolvePolicyMode(config.mode) ?? resolvePolicyMode(env.KOVA_CODEX_APP_SERVER_MODE);
  const defaultPolicy = explicitPolicyMode
    ? undefined
    : resolveDefaultCodexAppServerPolicy({
        transport,
        env,
        requirementsToml: params.requirementsToml,
        requirementsPath: params.requirementsPath,
        readRequirementsFile: params.readRequirementsFile,
        platform: params.platform,
        hostName: params.hostName,
      });
  const policyMode = explicitPolicyMode ?? defaultPolicy?.mode ?? "yolo";
  const serviceTier = resolveServiceTier(config.serviceTier);
  if (transport === "websocket" && !url) {
    throw new Error(
      "plugins.entries.codex.config.appServer.url is required when appServer.transport is websocket",
    );
  }

  return {
    start: {
      transport,
      command,
      commandSource,
      args: args.length > 0 ? args : ["app-server", "--listen", "stdio://"],
      ...(url ? { url } : {}),
      ...(authToken ? { authToken } : {}),
      headers,
    },
    requestTimeoutMs: normalizePositiveNumber(config.requestTimeoutMs, 60_000),
    approvalPolicy:
      resolveApprovalPolicy(config.approvalPolicy) ??
      resolveApprovalPolicy(env.KOVA_CODEX_APP_SERVER_APPROVAL_POLICY) ??
      defaultPolicy?.approvalPolicy ??
      (policyMode === "guardian" ? "on-request" : "never"),
    sandbox:
      resolveSandbox(config.sandbox) ??
      resolveSandbox(env.KOVA_CODEX_APP_SERVER_SANDBOX) ??
      defaultPolicy?.sandbox ??
      (policyMode === "guardian" ? "workspace-write" : "danger-full-access"),
    approvalsReviewer:
      resolveApprovalsReviewer(config.approvalsReviewer) ??
      defaultPolicy?.approvalsReviewer ??
      (policyMode === "guardian" ? "auto_review" : "user"),
    ...(serviceTier ? { serviceTier } : {}),
  };
}

export function resolveCodexComputerUseConfig(
  params: {
    pluginConfig?: unknown;
    env?: NodeJS.ProcessEnv;
    overrides?: Partial<CodexComputerUseConfig>;
  } = {},
): ResolvedCodexComputerUseConfig {
  const env = params.env ?? process.env;
  const config = readCodexPluginConfig(params.pluginConfig).computerUse ?? {};
  const marketplaceSource =
    readNonEmptyString(params.overrides?.marketplaceSource) ??
    readNonEmptyString(config.marketplaceSource) ??
    readNonEmptyString(env.KOVA_CODEX_COMPUTER_USE_MARKETPLACE_SOURCE);
  const marketplacePath =
    readNonEmptyString(params.overrides?.marketplacePath) ??
    readNonEmptyString(config.marketplacePath) ??
    readNonEmptyString(env.KOVA_CODEX_COMPUTER_USE_MARKETPLACE_PATH);
  const marketplaceName =
    readNonEmptyString(params.overrides?.marketplaceName) ??
    readNonEmptyString(config.marketplaceName) ??
    readNonEmptyString(env.KOVA_CODEX_COMPUTER_USE_MARKETPLACE_NAME);
  const autoInstall =
    params.overrides?.autoInstall ??
    config.autoInstall ??
    readBooleanEnv(env.KOVA_CODEX_COMPUTER_USE_AUTO_INSTALL) ??
    false;
  const marketplaceDiscoveryTimeoutMs = normalizePositiveNumber(
    params.overrides?.marketplaceDiscoveryTimeoutMs ??
      config.marketplaceDiscoveryTimeoutMs ??
      readNumberEnv(env.KOVA_CODEX_COMPUTER_USE_MARKETPLACE_DISCOVERY_TIMEOUT_MS),
    DEFAULT_CODEX_COMPUTER_USE_MARKETPLACE_DISCOVERY_TIMEOUT_MS,
  );
  const enabled =
    params.overrides?.enabled ??
    config.enabled ??
    readBooleanEnv(env.KOVA_CODEX_COMPUTER_USE) ??
    Boolean(autoInstall || marketplaceSource || marketplacePath || marketplaceName);

  return {
    enabled,
    autoInstall,
    marketplaceDiscoveryTimeoutMs,
    pluginName:
      readNonEmptyString(params.overrides?.pluginName) ??
      readNonEmptyString(config.pluginName) ??
      readNonEmptyString(env.KOVA_CODEX_COMPUTER_USE_PLUGIN_NAME) ??
      DEFAULT_CODEX_COMPUTER_USE_PLUGIN_NAME,
    mcpServerName:
      readNonEmptyString(params.overrides?.mcpServerName) ??
      readNonEmptyString(config.mcpServerName) ??
      readNonEmptyString(env.KOVA_CODEX_COMPUTER_USE_MCP_SERVER_NAME) ??
      DEFAULT_CODEX_COMPUTER_USE_MCP_SERVER_NAME,
    ...(marketplaceSource ? { marketplaceSource } : {}),
    ...(marketplacePath ? { marketplacePath } : {}),
    ...(marketplaceName ? { marketplaceName } : {}),
  };
}

export function codexAppServerStartOptionsKey(
  options: CodexAppServerStartOptions,
  params: { authProfileId?: string } = {},
): string {
  return JSON.stringify({
    transport: options.transport,
    command: options.command,
    commandSource: options.commandSource ?? null,
    args: options.args,
    url: options.url ?? null,
    authToken: hashSecretForKey(options.authToken),
    headers: Object.entries(options.headers).toSorted(([left], [right]) =>
      left.localeCompare(right),
    ),
    env: Object.entries(options.env ?? {}).toSorted(([left], [right]) => left.localeCompare(right)),
    clearEnv: [...(options.clearEnv ?? [])].toSorted(),
    authProfileId: params.authProfileId ?? null,
  });
}

export function codexSandboxPolicyForTurn(
  mode: CodexAppServerSandboxMode,
  cwd: string,
): CodexSandboxPolicy {
  if (mode === "danger-full-access") {
    return { type: "dangerFullAccess" };
  }
  if (mode === "read-only") {
    return { type: "readOnly", access: { type: "fullAccess" }, networkAccess: false };
  }
  return {
    type: "workspaceWrite",
    writableRoots: [cwd],
    readOnlyAccess: { type: "fullAccess" },
    networkAccess: false,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
}

function resolveTransport(value: unknown): CodexAppServerTransportMode {
  return value === "websocket" ? "websocket" : "stdio";
}

function resolvePolicyMode(value: unknown): CodexAppServerPolicyMode | undefined {
  return value === "guardian" || value === "yolo" ? value : undefined;
}

function resolveDefaultCodexAppServerPolicy(params: {
  transport: CodexAppServerTransportMode;
  env?: NodeJS.ProcessEnv;
  requirementsToml?: string | null;
  requirementsPath?: string;
  readRequirementsFile?: (path: string) => string | undefined;
  platform?: NodeJS.Platform;
  hostName?: string;
}): CodexAppServerDefaultPolicy {
  if (params.transport !== "stdio") {
    return { mode: "yolo" };
  }
  const content = readCodexRequirementsToml(params);
  if (content === undefined) {
    return { mode: "yolo" };
  }
  const allowedSandboxModes = parseAllowedSandboxModesFromCodexRequirements(
    content,
    readNonEmptyString(params.hostName) ?? readHostName(),
  );
  const allowedApprovalPolicies = parseAllowedApprovalPoliciesFromCodexRequirements(content);
  const allowedApprovalsReviewers = parseAllowedApprovalsReviewersFromCodexRequirements(content);
  const yoloSandboxAllowed =
    allowedSandboxModes === undefined || allowedSandboxModes.has("danger-full-access");
  const yoloApprovalAllowed =
    allowedApprovalPolicies === undefined || allowedApprovalPolicies.has("never");
  const yoloReviewerAllowed =
    allowedApprovalsReviewers === undefined || allowedApprovalsReviewers.has("user");
  if (yoloSandboxAllowed && yoloApprovalAllowed && yoloReviewerAllowed) {
    return { mode: "yolo" };
  }
  return {
    mode: "guardian",
    approvalPolicy: selectGuardianApprovalPolicy(allowedApprovalPolicies),
    approvalsReviewer: selectGuardianApprovalsReviewer(allowedApprovalsReviewers),
    sandbox: selectGuardianSandbox(allowedSandboxModes),
  };
}

function readCodexRequirementsToml(params: {
  env?: NodeJS.ProcessEnv;
  requirementsToml?: string | null;
  requirementsPath?: string;
  readRequirementsFile?: (path: string) => string | undefined;
  platform?: NodeJS.Platform;
}): string | undefined {
  if (params.requirementsToml !== undefined) {
    return params.requirementsToml ?? undefined;
  }
  const requirementsPath =
    readNonEmptyString(params.requirementsPath) ??
    resolveCodexRequirementsPath(params.env ?? process.env, params.platform ?? process.platform);
  try {
    if (params.readRequirementsFile) {
      return params.readRequirementsFile(requirementsPath);
    }
    return readFileSync(requirementsPath, "utf8");
  } catch {
    return undefined;
  }
}

function resolveCodexRequirementsPath(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  if (platform === "win32") {
    const programData = readNonEmptyString(env.ProgramData) ?? "C:\\ProgramData";
    return `${programData.replace(/[\\/]+$/, "")}${WINDOWS_CODEX_REQUIREMENTS_SUFFIX}`;
  }
  return UNIX_CODEX_REQUIREMENTS_PATH;
}

function parseAllowedSandboxModesFromCodexRequirements(
  content: string,
  hostName: string,
): Set<CodexAppServerSandboxMode> | undefined {
  const remoteSandboxModes = parseMatchingRemoteSandboxModesFromCodexRequirements(
    content,
    hostName,
  );
  if (remoteSandboxModes !== undefined) {
    return remoteSandboxModes;
  }
  const values = parseTopLevelRequirementsStringArray(content, "allowed_sandbox_modes");
  return parseRequirementsSandboxModes(values);
}

function parseAllowedApprovalPoliciesFromCodexRequirements(
  content: string,
): Set<CodexAppServerApprovalPolicy> | undefined {
  const values = parseTopLevelRequirementsStringArray(content, "allowed_approval_policies");
  if (values === undefined) {
    return undefined;
  }
  const normalizedPolicies = values
    .map((entry) => normalizeRequirementsApprovalPolicy(entry))
    .filter((entry): entry is CodexAppServerApprovalPolicy => entry !== undefined);
  return normalizedPolicies.length > 0 ? new Set(normalizedPolicies) : undefined;
}

function parseAllowedApprovalsReviewersFromCodexRequirements(
  content: string,
): Set<CodexAppServerApprovalsReviewer> | undefined {
  const values = parseTopLevelRequirementsStringArray(content, "allowed_approvals_reviewers");
  if (values === undefined) {
    return undefined;
  }
  const normalizedReviewers = values
    .map((entry) => normalizeRequirementsApprovalsReviewer(entry))
    .filter((entry): entry is CodexAppServerApprovalsReviewer => entry !== undefined);
  return normalizedReviewers.length > 0 ? new Set(normalizedReviewers) : undefined;
}

function parseMatchingRemoteSandboxModesFromCodexRequirements(
  content: string,
  hostName: string,
): Set<CodexAppServerSandboxMode> | undefined {
  const normalizedHostName = normalizeRequirementsHostName(hostName);
  if (normalizedHostName === undefined) {
    return undefined;
  }
  for (const section of parseTomlArrayTableSections(content, "remote_sandbox_config")) {
    const patterns = parseRequirementsStringArray(section, "hostname_patterns");
    if (!patterns || !requirementsHostNameMatchesAnyPattern(normalizedHostName, patterns)) {
      continue;
    }
    return parseRequirementsSandboxModes(
      parseRequirementsStringArray(section, "allowed_sandbox_modes"),
    );
  }
  return undefined;
}

function parseRequirementsSandboxModes(
  values: string[] | undefined,
): Set<CodexAppServerSandboxMode> | undefined {
  if (values === undefined) {
    return undefined;
  }
  const normalizedModes = values
    .map((entry) => normalizeRequirementsSandboxMode(entry))
    .filter((entry): entry is CodexAppServerSandboxMode => entry !== undefined);
  return normalizedModes.length > 0 ? new Set(normalizedModes) : undefined;
}

function parseTopLevelRequirementsStringArray(content: string, key: string): string[] | undefined {
  const topLevelContent = stripTomlLineComments(content).slice(0, firstTomlTableOffset(content));
  return parseRequirementsStringArray(topLevelContent, key);
}

function parseRequirementsStringArray(content: string, key: string): string[] | undefined {
  const match = content.match(new RegExp(`(?:^|\\n)\\s*${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) {
    return undefined;
  }
  const arrayBody = match[1] ?? "";
  const stringMatches = [...arrayBody.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'/g)];
  if (stringMatches.length === 0 && arrayBody.trim().length > 0) {
    return undefined;
  }
  return stringMatches.map((entry) => entry[1] ?? entry[2] ?? "");
}

function parseTomlArrayTableSections(content: string, table: string): string[] {
  const strippedContent = stripTomlLineComments(content);
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headerPattern = new RegExp(`^\\s*\\[\\[\\s*${escapedTable}\\s*\\]\\]\\s*$`, "gm");
  const sections: string[] = [];
  for (
    let match = headerPattern.exec(strippedContent);
    match;
    match = headerPattern.exec(strippedContent)
  ) {
    const sectionStart = headerPattern.lastIndex;
    const rest = strippedContent.slice(sectionStart);
    const nextTableOffset = rest.search(/^\s*\[/m);
    sections.push(nextTableOffset === -1 ? rest : rest.slice(0, nextTableOffset));
  }
  return sections;
}

function firstTomlTableOffset(content: string): number {
  const match = content.match(/^\s*\[[^\]\n]/m);
  return match?.index ?? content.length;
}

function stripTomlLineComments(value: string): string {
  let output = "";
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    if (quote) {
      output += char;
      if (quote === '"' && escaped) {
        escaped = false;
        continue;
      }
      if (quote === '"' && char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      output += char;
      continue;
    }
    if (char === "#") {
      while (index < value.length && value[index] !== "\n") {
        index += 1;
      }
      if (value[index] === "\n") {
        output += "\n";
      }
      continue;
    }
    output += char;
  }
  return output;
}

function normalizeRequirementsSandboxMode(value: string): CodexAppServerSandboxMode | undefined {
  const compact = value.replace(/[\s_-]/g, "").toLowerCase();
  if (compact === "readonly") {
    return "read-only";
  }
  if (compact === "workspacewrite") {
    return "workspace-write";
  }
  if (compact === "dangerfullaccess") {
    return "danger-full-access";
  }
  return undefined;
}

function normalizeRequirementsHostName(value: string): string | undefined {
  const normalized = value.trim().replace(/\.+$/g, "").toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function requirementsHostNameMatchesAnyPattern(hostName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const normalizedPattern = normalizeRequirementsHostName(pattern);
    return normalizedPattern !== undefined && globPatternMatches(hostName, normalizedPattern);
  });
}

function globPatternMatches(value: string, pattern: string): boolean {
  let regex = "^";
  for (const char of pattern) {
    if (char === "*") {
      regex += ".*";
    } else if (char === "?") {
      regex += ".";
    } else {
      regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  regex += "$";
  return new RegExp(regex).test(value);
}

function normalizeRequirementsApprovalPolicy(
  value: string,
): CodexAppServerApprovalPolicy | undefined {
  return resolveApprovalPolicy(value.trim().toLowerCase());
}

function normalizeRequirementsApprovalsReviewer(
  value: string,
): CodexAppServerApprovalsReviewer | undefined {
  return resolveApprovalsReviewer(value.trim().toLowerCase());
}

function selectGuardianApprovalPolicy(
  allowedApprovalPolicies: Set<CodexAppServerApprovalPolicy> | undefined,
): CodexAppServerApprovalPolicy {
  if (allowedApprovalPolicies === undefined || allowedApprovalPolicies.has("on-request")) {
    return "on-request";
  }
  if (allowedApprovalPolicies.has("on-failure")) {
    return "on-failure";
  }
  if (allowedApprovalPolicies.has("untrusted")) {
    return "untrusted";
  }
  if (allowedApprovalPolicies.has("never")) {
    return "never";
  }
  return "on-request";
}

function selectGuardianApprovalsReviewer(
  allowedApprovalsReviewers: Set<CodexAppServerApprovalsReviewer> | undefined,
): CodexAppServerApprovalsReviewer {
  if (allowedApprovalsReviewers === undefined || allowedApprovalsReviewers.has("auto_review")) {
    return "auto_review";
  }
  if (allowedApprovalsReviewers.has("guardian_subagent")) {
    return "guardian_subagent";
  }
  if (allowedApprovalsReviewers.has("user")) {
    return "user";
  }
  return "auto_review";
}

function selectGuardianSandbox(
  allowedSandboxModes: Set<CodexAppServerSandboxMode> | undefined,
): CodexAppServerSandboxMode {
  if (allowedSandboxModes === undefined || allowedSandboxModes.has("workspace-write")) {
    return "workspace-write";
  }
  if (allowedSandboxModes.has("read-only")) {
    return "read-only";
  }
  if (allowedSandboxModes.has("danger-full-access")) {
    return "danger-full-access";
  }
  return "workspace-write";
}

function resolveApprovalPolicy(value: unknown): CodexAppServerApprovalPolicy | undefined {
  return value === "on-request" ||
    value === "on-failure" ||
    value === "untrusted" ||
    value === "never"
    ? value
    : undefined;
}

function resolveSandbox(value: unknown): CodexAppServerSandboxMode | undefined {
  return value === "read-only" || value === "workspace-write" || value === "danger-full-access"
    ? value
    : undefined;
}

function resolveApprovalsReviewer(value: unknown): CodexAppServerApprovalsReviewer | undefined {
  return value === "auto_review" || value === "guardian_subagent" || value === "user"
    ? value
    : undefined;
}

function resolveServiceTier(value: unknown): CodexServiceTier | undefined {
  return value === "fast" || value === "flex" ? value : undefined;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key.trim(), readNonEmptyString(child)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[0] && entry[1])),
  );
}

function readBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function readNumberEnv(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveArgs(configArgs: unknown, envArgs: string | undefined): string[] {
  if (Array.isArray(configArgs)) {
    return configArgs
      .map((entry) => readNonEmptyString(entry))
      .filter((entry): entry is string => entry !== undefined);
  }
  if (typeof configArgs === "string") {
    return splitShellWords(configArgs);
  }
  return splitShellWords(envArgs ?? "");
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function hashSecretForKey(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return createHash("sha256").update(value).digest("hex");
}

function splitShellWords(value: string): string[] {
  const words: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const char of value) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) {
    words.push(current);
  }
  return words;
}
