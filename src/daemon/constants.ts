import { normalizeLowercaseStringOrEmpty } from "../shared/string-coerce.js";

// Default service labels (canonical + legacy compatibility)
export const GATEWAY_LAUNCH_AGENT_LABEL = "ai.kova.gateway";
export const GATEWAY_SYSTEMD_SERVICE_NAME = "kova-gateway";
export const GATEWAY_WINDOWS_TASK_NAME = "Kova Gateway";
export const GATEWAY_SERVICE_MARKER = "kova";
export const GATEWAY_SERVICE_KIND = "gateway";
export const NODE_LAUNCH_AGENT_LABEL = "ai.kova.node";
export const NODE_SYSTEMD_SERVICE_NAME = "kova-node";
export const NODE_WINDOWS_TASK_NAME = "Kova Node";
export const NODE_SERVICE_MARKER = "kova";
export const NODE_SERVICE_KIND = "node";
export const NODE_WINDOWS_TASK_SCRIPT_NAME = "node.cmd";
export const LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES: string[] = [
  "openclaw-gateway",
  "clawdbot-gateway",
];
export const LEGACY_GATEWAY_SERVICE_MARKERS: string[] = ["openclaw"];

export function normalizeGatewayProfile(profile?: string): string | null {
  const trimmed = profile?.trim();
  if (!trimmed || normalizeLowercaseStringOrEmpty(trimmed) === "default") {
    return null;
  }
  return trimmed;
}

export function resolveGatewayProfileSuffix(profile?: string): string {
  const normalized = normalizeGatewayProfile(profile);
  return normalized ? `-${normalized}` : "";
}

export function resolveGatewayLaunchAgentLabel(profile?: string): string {
  const normalized = normalizeGatewayProfile(profile);
  if (!normalized) {
    return GATEWAY_LAUNCH_AGENT_LABEL;
  }
  return `ai.kova.${normalized}`;
}

export function resolveLegacyGatewayLaunchAgentLabels(profile?: string): string[] {
  const normalized = normalizeGatewayProfile(profile);
  if (!normalized) {
    return ["ai.openclaw.gateway"];
  }
  return [`ai.openclaw.${normalized}`];
}

export function resolveLegacyGatewaySystemdServiceNames(profile?: string): string[] {
  const suffix = resolveGatewayProfileSuffix(profile);
  if (!suffix) {
    return LEGACY_GATEWAY_SYSTEMD_SERVICE_NAMES;
  }
  return [`openclaw-gateway${suffix}`];
}

export function resolveGatewaySystemdServiceName(profile?: string): string {
  const suffix = resolveGatewayProfileSuffix(profile);
  if (!suffix) {
    return GATEWAY_SYSTEMD_SERVICE_NAME;
  }
  return `kova-gateway${suffix}`;
}

export function resolveGatewayWindowsTaskName(profile?: string): string {
  const normalized = normalizeGatewayProfile(profile);
  if (!normalized) {
    return GATEWAY_WINDOWS_TASK_NAME;
  }
  return `Kova Gateway (${normalized})`;
}

export function isGatewayServiceMarker(value?: string): boolean {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  if (!normalized) {
    return false;
  }
  return (
    normalized === normalizeLowercaseStringOrEmpty(GATEWAY_SERVICE_MARKER) ||
    LEGACY_GATEWAY_SERVICE_MARKERS.includes(normalized)
  );
}

export function formatGatewayServiceDescription(params?: {
  profile?: string;
  version?: string;
}): string {
  const profile = normalizeGatewayProfile(params?.profile);
  const version = params?.version?.trim();
  const parts: string[] = [];
  if (profile) {
    parts.push(`profile: ${profile}`);
  }
  if (version) {
    parts.push(`v${version}`);
  }
  if (parts.length === 0) {
    return "Kova Gateway";
  }
  return `Kova Gateway (${parts.join(", ")})`;
}

export function resolveGatewayServiceDescription(params: {
  env: Record<string, string | undefined>;
  environment?: Record<string, string | undefined>;
  description?: string;
}): string {
  return (
    params.description ??
    formatGatewayServiceDescription({
      profile: params.env.KOVA_PROFILE ?? params.env.OPENCLAW_PROFILE,
      version:
        params.environment?.KOVA_SERVICE_VERSION ??
        params.environment?.OPENCLAW_SERVICE_VERSION ??
        params.env.KOVA_SERVICE_VERSION ??
        params.env.OPENCLAW_SERVICE_VERSION,
    })
  );
}

export function resolveNodeLaunchAgentLabel(): string {
  return NODE_LAUNCH_AGENT_LABEL;
}

export function resolveNodeSystemdServiceName(): string {
  return NODE_SYSTEMD_SERVICE_NAME;
}

export function resolveNodeWindowsTaskName(): string {
  return NODE_WINDOWS_TASK_NAME;
}

export function formatNodeServiceDescription(params?: { version?: string }): string {
  const version = params?.version?.trim();
  if (!version) {
    return "Kova Node Host";
  }
  return `Kova Node Host (v${version})`;
}
