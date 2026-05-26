import type { GatewayBindMode } from "../config/types.gateway.js";
import { safeNetworkInterfaces } from "../infra/network-interfaces.js";
import { pickPrimaryTailnetIPv4 } from "../infra/tailnet.js";
import { isCanonicalDottedDecimalIPv4 } from "../shared/net/ip.js";

function resolveGatewayDisplayHost(bind: GatewayBindMode | undefined, customBindHost?: string) {
  if (bind === "custom" && customBindHost?.trim()) {
    const host = customBindHost.trim();
    return isCanonicalDottedDecimalIPv4(host) ? host : "127.0.0.1";
  }
  if (bind === "lan") {
    if (!safeNetworkInterfaces()) {
      return "127.0.0.1";
    }
    return "0.0.0.0";
  }
  if (bind === "tailnet") {
    try {
      return pickPrimaryTailnetIPv4() ?? "127.0.0.1";
    } catch {
      return "127.0.0.1";
    }
  }
  return "127.0.0.1";
}

export function resolveGatewayHttpLinks(params: {
  port: number;
  bind?: GatewayBindMode;
  customBindHost?: string;
  tlsEnabled?: boolean;
}): { httpUrl: string; wsUrl: string } {
  const host = resolveGatewayDisplayHost(params.bind, params.customBindHost);
  const httpScheme = params.tlsEnabled ? "https" : "http";
  const wsScheme = params.tlsEnabled ? "wss" : "ws";
  return {
    httpUrl: `${httpScheme}://${host}:${params.port}/`,
    wsUrl: `${wsScheme}://${host}:${params.port}`,
  };
}
