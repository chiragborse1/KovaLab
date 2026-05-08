import { KOVA_RUNTIME_CONTEXT_CUSTOM_TYPE } from "../../internal-runtime-context.js";
import type { CurrentTurnPromptContext } from "./params.js";

type RuntimeContextSession = {
  sendCustomMessage: (
    message: {
      customType: string;
      content: string;
      display: boolean;
      details?: Record<string, unknown>;
    },
    options?: { deliverAs?: "nextTurn"; triggerTurn?: boolean },
  ) => Promise<void>;
};

type RuntimeContextPromptParts = {
  prompt: string;
  runtimeContext?: string;
  runtimeOnly?: boolean;
  runtimeSystemContext?: string;
};

function removeLastPromptOccurrence(text: string, prompt: string): string | null {
  const index = text.lastIndexOf(prompt);
  if (index === -1) {
    return null;
  }
  const before = text.slice(0, index).trimEnd();
  const after = text.slice(index + prompt.length).trimStart();
  return [before, after]
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
}

export function resolveRuntimeContextPromptParts(params: {
  effectivePrompt: string;
  transcriptPrompt?: string;
}): RuntimeContextPromptParts {
  const transcriptPrompt = params.transcriptPrompt;
  if (transcriptPrompt === undefined || transcriptPrompt === params.effectivePrompt) {
    return { prompt: params.effectivePrompt };
  }

  const prompt = transcriptPrompt.trim();
  const runtimeContext =
    removeLastPromptOccurrence(params.effectivePrompt, transcriptPrompt)?.trim() ||
    params.effectivePrompt.trim();
  if (!prompt) {
    return runtimeContext
      ? {
          prompt: "",
          runtimeContext,
          runtimeOnly: true,
          runtimeSystemContext: buildRuntimeEventSystemContext(runtimeContext),
        }
      : { prompt: "" };
  }

  return runtimeContext ? { prompt, runtimeContext } : { prompt };
}

function buildRuntimeContextMessageContent(params: {
  runtimeContext: string;
  kind: "next-turn" | "runtime-event";
}): string {
  return [
    params.kind === "runtime-event"
      ? "Kova runtime event."
      : "Kova runtime context for the immediately preceding user message.",
    "This context is runtime-generated, not user-authored. Keep internal details private.",
    "",
    params.runtimeContext,
  ].join("\n");
}

function sanitizeCurrentTurnContextString(value: string): string {
  return value.replace(/\u0000/g, "").slice(0, 4000);
}

export function buildCurrentTurnPromptContextSuffix(
  context: CurrentTurnPromptContext | undefined,
): string {
  const replyChain = context?.replyChain?.filter(
    (entry) =>
      entry.body?.trim() ||
      entry.mediaType?.trim() ||
      entry.mediaPath?.trim() ||
      entry.mediaRef?.trim(),
  );
  if (!replyChain || replyChain.length === 0) {
    return "";
  }
  const payload = replyChain.map((entry) => ({
    message_id: entry.messageId ? sanitizeCurrentTurnContextString(entry.messageId) : undefined,
    thread_id: entry.threadId ? sanitizeCurrentTurnContextString(entry.threadId) : undefined,
    sender: entry.sender ? sanitizeCurrentTurnContextString(entry.sender) : undefined,
    sender_id: entry.senderId ? sanitizeCurrentTurnContextString(entry.senderId) : undefined,
    sender_username: entry.senderUsername
      ? sanitizeCurrentTurnContextString(entry.senderUsername)
      : undefined,
    timestamp: entry.timestamp,
    body: entry.body ? sanitizeCurrentTurnContextString(entry.body) : undefined,
    is_quote: entry.isQuote === true ? true : undefined,
    media_type: entry.mediaType ? sanitizeCurrentTurnContextString(entry.mediaType) : undefined,
    media_path: entry.mediaPath ? sanitizeCurrentTurnContextString(entry.mediaPath) : undefined,
    media_ref: entry.mediaRef ? sanitizeCurrentTurnContextString(entry.mediaRef) : undefined,
    reply_to_id: entry.replyToId ? sanitizeCurrentTurnContextString(entry.replyToId) : undefined,
    forwarded_from: entry.forwardedFrom
      ? sanitizeCurrentTurnContextString(entry.forwardedFrom)
      : undefined,
    forwarded_from_id: entry.forwardedFromId
      ? sanitizeCurrentTurnContextString(entry.forwardedFromId)
      : undefined,
    forwarded_from_username: entry.forwardedFromUsername
      ? sanitizeCurrentTurnContextString(entry.forwardedFromUsername)
      : undefined,
    forwarded_date: entry.forwardedDate,
  }));
  return [
    "",
    "Reply chain of current user message (untrusted, nearest first):",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

export function buildRuntimeEventSystemContext(runtimeContext: string): string {
  return buildRuntimeContextMessageContent({ runtimeContext, kind: "runtime-event" });
}

export async function queueRuntimeContextForNextTurn(params: {
  session: RuntimeContextSession;
  runtimeContext?: string;
}): Promise<void> {
  const runtimeContext = params.runtimeContext?.trim();
  if (!runtimeContext) {
    return;
  }
  await params.session.sendCustomMessage(
    {
      customType: KOVA_RUNTIME_CONTEXT_CUSTOM_TYPE,
      content: buildRuntimeContextMessageContent({ runtimeContext, kind: "next-turn" }),
      display: false,
      details: { source: "kova-runtime-context" },
    },
    { deliverAs: "nextTurn" },
  );
}
