import {
  DEFAULT_HEARTBEAT_EVERY,
  resolveHeartbeatPrompt as resolveHeartbeatPromptText,
} from "../auto-reply/heartbeat.js";
import { parseDurationMs } from "../cli/parse-duration.js";
import type { AgentDefaultsConfig } from "../config/types.agent-defaults.js";
import type { KovaConfig } from "../config/types.kova.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";
import { listAgentEntries, resolveAgentConfig, resolveDefaultAgentId } from "./agent-scope.js";

type HeartbeatConfig = AgentDefaultsConfig["heartbeat"];

function mergePulseConfig(
  defaults?: HeartbeatConfig,
  defaultsPulse?: HeartbeatConfig,
  overrides?: HeartbeatConfig,
  overridesPulse?: HeartbeatConfig,
): HeartbeatConfig | undefined {
  if (!defaults && !defaultsPulse && !overrides && !overridesPulse) {
    return undefined;
  }
  return { ...defaults, ...defaultsPulse, ...overrides, ...overridesPulse };
}

function resolveHeartbeatConfigForSystemPrompt(
  config?: KovaConfig,
  agentId?: string,
): HeartbeatConfig | undefined {
  const defaults = config?.agents?.defaults?.heartbeat;
  const defaultsPulse = config?.agents?.defaults?.pulse;
  if (!config || !agentId) {
    return mergePulseConfig(defaults, defaultsPulse);
  }
  const agentConfig = resolveAgentConfig(config, agentId);
  return mergePulseConfig(defaults, defaultsPulse, agentConfig?.heartbeat, agentConfig?.pulse);
}

function isHeartbeatEnabledByAgentPolicy(config: KovaConfig, agentId: string): boolean {
  const resolvedAgentId = normalizeAgentId(agentId);
  const agents = listAgentEntries(config);
  const hasExplicitHeartbeatAgents = agents.some((entry) =>
    Boolean(entry?.pulse ?? entry?.heartbeat),
  );
  if (hasExplicitHeartbeatAgents) {
    return agents.some(
      (entry) =>
        Boolean(entry?.pulse ?? entry?.heartbeat) && normalizeAgentId(entry.id) === resolvedAgentId,
    );
  }
  return resolvedAgentId === resolveDefaultAgentId(config);
}

function isHeartbeatCadenceEnabled(heartbeat?: HeartbeatConfig): boolean {
  const rawEvery = heartbeat?.every ?? DEFAULT_HEARTBEAT_EVERY;
  const trimmedEvery = normalizeOptionalString(rawEvery) ?? "";
  if (!trimmedEvery) {
    return false;
  }
  try {
    return parseDurationMs(trimmedEvery, { defaultUnit: "m" }) > 0;
  } catch {
    return false;
  }
}

export function shouldIncludeHeartbeatGuidanceForSystemPrompt(params: {
  config?: KovaConfig;
  agentId?: string;
  defaultAgentId?: string;
}): boolean {
  const defaultAgentId = params.defaultAgentId ?? resolveDefaultAgentId(params.config ?? {});
  const agentId = params.agentId ?? defaultAgentId;
  if (!agentId || normalizeAgentId(agentId) !== normalizeAgentId(defaultAgentId)) {
    return false;
  }
  if (params.config && !isHeartbeatEnabledByAgentPolicy(params.config, agentId)) {
    return false;
  }
  const heartbeat = resolveHeartbeatConfigForSystemPrompt(params.config, agentId);
  if (heartbeat?.includeSystemPromptSection === false) {
    return false;
  }
  return isHeartbeatCadenceEnabled(heartbeat);
}

export function resolveHeartbeatPromptForSystemPrompt(params: {
  config?: KovaConfig;
  agentId?: string;
  defaultAgentId?: string;
}): string | undefined {
  const agentId =
    params.agentId ?? params.defaultAgentId ?? resolveDefaultAgentId(params.config ?? {});
  const heartbeat = resolveHeartbeatConfigForSystemPrompt(params.config, agentId);
  if (!shouldIncludeHeartbeatGuidanceForSystemPrompt(params)) {
    return undefined;
  }
  return resolveHeartbeatPromptText(heartbeat?.prompt);
}
