/**
 * Core gateway entry point — thin shell that wires together:
 *
 * - GatewayConnection: WebSocket lifecycle, heartbeat, reconnect
 * - buildInboundContext: content building, attachments, quote resolution
 * - dispatchOutbound: AI dispatch, deliver callbacks, timeouts
 *
 * The only responsibilities of this file are:
 * 1. Register audio adapters
 * 2. Initialize API config + refIdx cache hook
 * 3. Create the message handler (inbound → outbound pipeline)
 * 4. Start GatewayConnection
 */

import path from "node:path";
import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { authorizeQQBotApprovalAction } from "../../exec-approvals.js";
import { getPlatformAdapter } from "../adapter/index.js";
import { parseApprovalButtonData } from "../approval/index.js";
import { registerOutboundAudioAdapter } from "../messaging/outbound.js";
import {
  clearTokenCache,
  getAccessToken,
  initApiConfig,
  onMessageSent,
  sendInputNotify as senderSendInputNotify,
  createRawInputNotifyFn,
  accountToCreds,
  acknowledgeInteraction,
} from "../messaging/sender.js";
import { setRefIndex } from "../ref/store.js";
import type { InteractionEvent } from "../types.js";
import {
  audioFileToSilkBase64,
  convertSilkToWav,
  isVoiceAttachment,
  isAudioFile,
  shouldTranscodeVoice,
  waitForFile,
} from "../utils/audio.js";
import { runDiagnostics } from "../utils/diagnostics.js";
import { formatDuration } from "../utils/format.js";
import { runWithRequestContext } from "../utils/request-context.js";
import { GatewayConnection } from "./gateway-connection.js";
import { registerAudioConvertAdapter } from "./inbound-attachments.js";
import { buildInboundContext } from "./inbound-pipeline.js";
import type { QueuedMessage } from "./message-queue.js";
import { dispatchOutbound } from "./outbound-dispatch.js";
import type {
  CoreGatewayContext,
  GatewayAccount,
  EngineLogger,
  RefAttachmentSummary,
} from "./types.js";
import { TypingKeepAlive, TYPING_INPUT_SECOND } from "./typing-keepalive.js";

// Re-export context type for consumers.
export type { CoreGatewayContext } from "./types.js";

// ============ startGateway ============

/**
 * Start the Gateway WebSocket connection with automatic reconnect support.
 */
export async function startGateway(ctx: CoreGatewayContext): Promise<void> {
  const { account, log, runtime } = ctx;

  // ---- 1. Register audio adapters ----
  registerAudioConvertAdapter({ convertSilkToWav, isVoiceAttachment, formatDuration });
  registerOutboundAudioAdapter({
    audioFileToSilkBase64: async (p, f) => (await audioFileToSilkBase64(p, f)) ?? undefined,
    isAudioFile,
    shouldTranscodeVoice,
    waitForFile,
  });

  // ---- 2. Validate ----
  if (!account.appId || !account.clientSecret) {
    throw new Error("QQBot not configured (missing appId or clientSecret)");
  }

  // ---- 3. Diagnostics ----
  const diag = await runDiagnostics();
  if (diag.warnings.length > 0) {
    for (const w of diag.warnings) {
      log?.info(w);
    }
  }

  // ---- 4. API config ----
  initApiConfig(account.appId, { markdownSupport: account.markdownSupport });
  log?.debug?.(`API config: markdownSupport=${account.markdownSupport}`);

  // ---- 5. Outbound refIdx cache hook ----
  onMessageSent(account.appId, (refIdx, meta) => {
    log?.info(
      `onMessageSent called: refIdx=${refIdx}, mediaType=${meta.mediaType}, ttsText=${meta.ttsText?.slice(0, 30)}`,
    );
    const attachments: RefAttachmentSummary[] = [];
    if (meta.mediaType) {
      const localPath = meta.mediaLocalPath;
      const filename = localPath ? path.basename(localPath) : undefined;
      const attachment: RefAttachmentSummary = {
        type: meta.mediaType,
        ...(localPath ? { localPath } : {}),
        ...(filename ? { filename } : {}),
        ...(meta.mediaUrl ? { url: meta.mediaUrl } : {}),
      };
      if (meta.mediaType === "voice" && meta.ttsText) {
        attachment.transcript = meta.ttsText;
        attachment.transcriptSource = "tts";
      }
      attachments.push(attachment);
    }
    setRefIndex(refIdx, {
      content: meta.text ?? "",
      senderId: account.accountId,
      senderName: account.accountId,
      timestamp: Date.now(),
      isBot: true,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
  });

  // ---- 6. Message handler ----
  const handleMessage = async (event: QueuedMessage): Promise<void> => {
    log?.info(`Processing message from ${event.senderId}: ${event.content}`);

    runtime.channel.activity.record({
      channel: "qqbot",
      accountId: account.accountId,
      direction: "inbound",
    });

    const inbound = await buildInboundContext(event, {
      account,
      cfg: ctx.cfg,
      log,
      runtime,
      startTyping: (ev) => startTypingForEvent(ev, account, log),
    });

    if (inbound.blocked) {
      log?.info(`Dropped inbound qqbot message: ${inbound.blockReason ?? "blocked by allowFrom"}`);
      inbound.typing.keepAlive?.stop();
      return;
    }

    try {
      await runWithRequestContext(
        {
          accountId: account.accountId,
          target: inbound.qualifiedTarget,
          targetId: inbound.peerId,
          chatType: event.type,
        },
        () => dispatchOutbound(inbound, { runtime, cfg: ctx.cfg, account, log }),
      );
    } catch (err) {
      log?.error(`Message processing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      inbound.typing.keepAlive?.stop();
    }
  };

  // ---- 7. Interaction handler ----
  const handleInteraction = createApprovalInteractionHandler(account, log, {
    getActiveCfg: () => ctx.cfg as KovaConfig,
  });

  // ---- 8. Start connection ----
  const connection = new GatewayConnection({
    account,
    abortSignal: ctx.abortSignal,
    cfg: ctx.cfg,
    log,
    runtime,
    onReady: ctx.onReady,
    onResumed: ctx.onResumed,
    onError: ctx.onError,
    onInteraction: handleInteraction,
    handleMessage,
  });

  await connection.start();
}

// ============ Typing helper ============

/**
 * Start typing indicator for a C2C event.
 * Returns the refIdx from InputNotify and a TypingKeepAlive handle.
 */
async function startTypingForEvent(
  event: QueuedMessage,
  account: GatewayAccount,
  log?: EngineLogger,
): Promise<{ refIdx?: string; keepAlive: TypingKeepAlive | null }> {
  const isC2C = event.type === "c2c" || event.type === "dm";
  if (!isC2C) {
    return { keepAlive: null };
  }
  try {
    const creds = accountToCreds(account);
    const rawNotifyFn = createRawInputNotifyFn(account.appId);
    try {
      const resp = await senderSendInputNotify({
        openid: event.senderId,
        creds,
        msgId: event.messageId,
        inputSecond: TYPING_INPUT_SECOND,
      });
      const keepAlive = new TypingKeepAlive(
        () => getAccessToken(account.appId, account.clientSecret),
        () => clearTokenCache(account.appId),
        rawNotifyFn,
        event.senderId,
        event.messageId,
        log,
      );
      keepAlive.start();
      return { refIdx: resp.refIdx, keepAlive };
    } catch (notifyErr) {
      const errMsg = String(notifyErr);
      if (errMsg.includes("token") || errMsg.includes("401") || errMsg.includes("11244")) {
        clearTokenCache(account.appId);
        const resp = await senderSendInputNotify({
          openid: event.senderId,
          creds,
          msgId: event.messageId,
          inputSecond: TYPING_INPUT_SECOND,
        });
        const keepAlive = new TypingKeepAlive(
          () => getAccessToken(account.appId, account.clientSecret),
          () => clearTokenCache(account.appId),
          rawNotifyFn,
          event.senderId,
          event.messageId,
          log,
        );
        keepAlive.start();
        return { refIdx: resp.refIdx, keepAlive };
      }
      throw notifyErr;
    }
  } catch (err) {
    log?.error(`sendInputNotify error: ${err instanceof Error ? err.message : String(err)}`);
    return { keepAlive: null };
  }
}

// ============ Interaction handler ============

/**
 * Default INTERACTION_CREATE handler — ACK the interaction and resolve
 * approval button clicks via the registered PlatformAdapter.
 */
export function createApprovalInteractionHandler(
  account: GatewayAccount,
  log?: EngineLogger,
  options?: { getActiveCfg?: () => KovaConfig },
): (event: InteractionEvent) => void {
  return (event) => {
    const creds = accountToCreds(account);

    const buttonData = event.data?.resolved?.button_data ?? "";
    const parsed = parseApprovalButtonData(buttonData);
    if (!parsed) {
      void acknowledgeApprovalInteraction(creds, event, log);
      return;
    }

    void handleApprovalButtonInteraction({
      accountId: account.accountId,
      creds,
      event,
      getActiveCfg: options?.getActiveCfg,
      log,
      parsed,
    });
  };
}

async function handleApprovalButtonInteraction(params: {
  accountId: string;
  creds: { appId: string; clientSecret: string };
  event: InteractionEvent;
  getActiveCfg?: () => KovaConfig;
  log?: EngineLogger;
  parsed: { approvalId: string; decision: "allow-once" | "allow-always" | "deny" };
}): Promise<void> {
  if (!params.getActiveCfg) {
    await acknowledgeApprovalInteraction(params.creds, params.event, params.log, {
      content: "Approval is unavailable.",
    });
    params.log?.error("Approval button rejected: active config is unavailable");
    return;
  }

  let cfg: KovaConfig;
  try {
    cfg = params.getActiveCfg();
  } catch (err) {
    await acknowledgeApprovalInteraction(params.creds, params.event, params.log, {
      content: "Approval is unavailable.",
    });
    params.log?.error(
      `Approval button rejected: active config failed to load: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return;
  }

  const authorization = authorizeApprovalButtonActor({
    cfg,
    accountId: params.accountId,
    event: params.event,
    approvalKind: resolveApprovalKind(params.parsed.approvalId),
  });
  if (!authorization.authorized) {
    await acknowledgeApprovalInteraction(params.creds, params.event, params.log, {
      content: authorization.reason ?? "You are not authorized to approve this request.",
    });
    params.log?.info(`Approval button rejected: id=${params.parsed.approvalId}`);
    return;
  }

  await acknowledgeApprovalInteraction(params.creds, params.event, params.log);

  const adapter = getPlatformAdapter();
  if (!adapter.resolveApproval) {
    params.log?.error(`resolveApproval not available on PlatformAdapter`);
    return;
  }

  try {
    const ok = await adapter.resolveApproval(params.parsed.approvalId, params.parsed.decision);
    if (ok) {
      params.log?.info(
        `Approval resolved: id=${params.parsed.approvalId}, decision=${params.parsed.decision}`,
      );
    } else {
      params.log?.error(`Approval resolve failed: id=${params.parsed.approvalId}`);
    }
  } catch (err) {
    params.log?.error(
      `Approval resolve failed: id=${params.parsed.approvalId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function acknowledgeApprovalInteraction(
  creds: { appId: string; clientSecret: string },
  event: InteractionEvent,
  log: EngineLogger | undefined,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await acknowledgeInteraction(creds, event.id, 0, data);
  } catch (err) {
    log?.error(`Interaction ACK failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function authorizeApprovalButtonActor(params: {
  cfg: KovaConfig;
  accountId: string;
  event: InteractionEvent;
  approvalKind: "exec" | "plugin";
}): { authorized: boolean; reason?: string } {
  const senderIds = resolveApprovalActorSenderIds(params.event);
  if (senderIds.length === 0) {
    return authorizeQQBotApprovalAction({
      cfg: params.cfg,
      accountId: params.accountId,
      senderId: null,
      approvalKind: params.approvalKind,
    });
  }

  let denial: { authorized: boolean; reason?: string } | undefined;
  for (const senderId of senderIds) {
    const result = authorizeQQBotApprovalAction({
      cfg: params.cfg,
      accountId: params.accountId,
      senderId,
      approvalKind: params.approvalKind,
    });
    if (result.authorized) {
      return result;
    }
    denial ??= result;
  }
  return denial ?? { authorized: false, reason: "You are not authorized to approve this request." };
}

function resolveApprovalActorSenderIds(event: InteractionEvent): string[] {
  const ids = [event.group_member_openid, event.user_openid].flatMap((value) => {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized ? [normalized] : [];
  });
  return Array.from(new Set(ids));
}

function resolveApprovalKind(approvalId: string): "exec" | "plugin" {
  return approvalId.toLowerCase().startsWith("plugin:") ? "plugin" : "exec";
}
