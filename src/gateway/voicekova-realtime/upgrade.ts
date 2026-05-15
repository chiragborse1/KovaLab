import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import type { KovaConfig } from "../../config/types.kova.js";
import type { AuthRateLimiter } from "../auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "../auth.js";
import { VOICEKOVA_REALTIME_PATH } from "./paths.js";
import { VoiceKovaRealtimeSession } from "./session.js";

export { VOICEKOVA_REALTIME_PATH };

const wss = new WebSocketServer({ noServer: true });

export function handleVoiceKovaRealtimeUpgrade(opts: {
  req: IncomingMessage;
  socket: Duplex;
  head: Buffer;
  auth: ResolvedGatewayAuth;
  config: KovaConfig;
  trustedProxies: string[];
  allowRealIpFallback: boolean;
  rateLimiter?: AuthRateLimiter;
  releasePreauthBudget: () => void;
}): void {
  wss.handleUpgrade(opts.req, opts.socket, opts.head, (ws) => {
    const session = new VoiceKovaRealtimeSession({
      ws,
      req: opts.req,
      auth: opts.auth,
      config: opts.config,
      trustedProxies: opts.trustedProxies,
      allowRealIpFallback: opts.allowRealIpFallback,
      rateLimiter: opts.rateLimiter,
      releasePreauthBudget: opts.releasePreauthBudget,
    });
    session.attach();
  });
}
