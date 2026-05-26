import type { GatewayBindMode } from "../config/types.gateway.js";

function resolveGatewayDisplayHost(bind: GatewayBindMode | undefined, customBindHost?: string) {
  if (bind === "custom" && customBindHost?.trim()) {
    return customBindHost.trim();
  }
  if (bind === "lan") {
    return "0.0.0.0";
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
    httpUrl: `${httpScheme}://${host}:${params.port}`,
    wsUrl: `${wsScheme}://${host}:${params.port}`,
  };
}
