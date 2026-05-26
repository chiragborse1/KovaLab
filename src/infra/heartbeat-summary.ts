import { resolveAgentConfig, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  DEFAULT_HEARTBEAT_ACK_MAX_CHARS,
  DEFAULT_HEARTBEAT_EVERY,
  resolveHeartbeatPrompt as resolveHeartbeatPromptText,
} from "../auto-reply/heartbeat.js";
import { parseDurationMs } from "../cli/parse-duration.js";
import type { AgentDefaultsConfig } from "../config/types.agent-defaults.js";
import type { KovaConfig } from "../config/types.kova.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { normalizeOptionalString } from "../shared/string-coerce.js";

type HeartbeatConfig = AgentDefaultsConfig["heartbeat"];

export type HeartbeatSummary = {
  enabled: boolean;
  every: string;
  everyMs: number | null;
  prompt: string;
  target: string;
  model?: string;
  ackMaxChars: number;
};

const DEFAULT_HEARTBEAT_TARGET = "none";

function hasExplicitHeartbeatAgents(cfg: KovaConfig) {
  const list = cfg.agents?.list ?? [];
  return list.some((entry) => Boolean(entry?.pulse ?? entry?.heartbeat));
}

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

export function isHeartbeatEnabledForAgent(cfg: KovaConfig, agentId?: string): boolean {
  const resolvedAgentId = normalizeAgentId(agentId ?? resolveDefaultAgentId(cfg));
  const list = cfg.agents?.list ?? [];
  const hasExplicit = hasExplicitHeartbeatAgents(cfg);
  if (hasExplicit) {
    return list.some(
      (entry) =>
        Boolean(entry?.pulse ?? entry?.heartbeat) &&
        normalizeAgentId(entry?.id) === resolvedAgentId,
    );
  }
  return resolvedAgentId === resolveDefaultAgentId(cfg);
}

export function resolveHeartbeatIntervalMs(
  cfg: KovaConfig,
  overrideEvery?: string,
  heartbeat?: HeartbeatConfig,
) {
  const raw =
    overrideEvery ??
    heartbeat?.every ??
    cfg.agents?.defaults?.pulse?.every ??
    cfg.agents?.defaults?.heartbeat?.every ??
    DEFAULT_HEARTBEAT_EVERY;
  if (!raw) {
    return null;
  }
  const trimmed = normalizeOptionalString(raw) ?? "";
  if (!trimmed) {
    return null;
  }
  let ms: number;
  try {
    ms = parseDurationMs(trimmed, { defaultUnit: "m" });
  } catch {
    return null;
  }
  if (ms <= 0) {
    return null;
  }
  return ms;
}

export function resolveHeartbeatSummaryForAgent(
  cfg: KovaConfig,
  agentId?: string,
): HeartbeatSummary {
  const defaults = cfg.agents?.defaults?.heartbeat;
  const defaultsPulse = cfg.agents?.defaults?.pulse;
  const agentConfig = agentId ? resolveAgentConfig(cfg, agentId) : undefined;
  const overrides = agentConfig?.heartbeat;
  const overridesPulse = agentConfig?.pulse;
  const enabled = isHeartbeatEnabledForAgent(cfg, agentId);
  const base = mergePulseConfig(defaults, defaultsPulse);
  const merged = mergePulseConfig(defaults, defaultsPulse, overrides, overridesPulse);

  if (!enabled) {
    return {
      enabled: false,
      every: "disabled",
      everyMs: null,
      prompt: resolveHeartbeatPromptText(base?.prompt),
      target: base?.target ?? DEFAULT_HEARTBEAT_TARGET,
      model: base?.model,
      ackMaxChars: Math.max(0, base?.ackMaxChars ?? DEFAULT_HEARTBEAT_ACK_MAX_CHARS),
    };
  }

  const every = merged?.every ?? DEFAULT_HEARTBEAT_EVERY;
  const everyMs = resolveHeartbeatIntervalMs(cfg, undefined, merged);
  const prompt = resolveHeartbeatPromptText(merged?.prompt);
  const target = merged?.target ?? DEFAULT_HEARTBEAT_TARGET;
  const model = merged?.model;
  const ackMaxChars = Math.max(0, merged?.ackMaxChars ?? DEFAULT_HEARTBEAT_ACK_MAX_CHARS);

  return {
    enabled: true,
    every,
    everyMs,
    prompt,
    target,
    model,
    ackMaxChars,
  };
}
