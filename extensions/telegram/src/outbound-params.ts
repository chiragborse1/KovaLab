function parseIntegerId(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  if (!/^-?\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseNonNegativeIntegerId(value: unknown): number | undefined {
  const parsed = parseIntegerId(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}

export function parseTelegramMessageThreadId(value: unknown): number | undefined {
  return parseNonNegativeIntegerId(value);
}

export function normalizeTelegramReplyToMessageId(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return parseIntegerId(value);
  }
  const trimmed = value.trim();
  return trimmed ? parseIntegerId(trimmed) : undefined;
}

export function parseTelegramReplyToMessageId(replyToId?: unknown): number | undefined {
  return normalizeTelegramReplyToMessageId(replyToId);
}

export function parseTelegramThreadId(threadId?: string | number | null): number | undefined {
  if (threadId == null) {
    return undefined;
  }
  if (typeof threadId === "number") {
    return parseIntegerId(threadId);
  }
  const trimmed = threadId.trim();
  if (!trimmed) {
    return undefined;
  }
  const topicMatch = /^-?\d+:topic:(\d+)$/.exec(trimmed);
  if (topicMatch) {
    return parseIntegerId(topicMatch[1]);
  }
  // DM topic session keys may scope thread ids as "<chatId>:<threadId>".
  const scopedMatch = /^-?\d+:(-?\d+)$/.exec(trimmed);
  const rawThreadId = scopedMatch ? scopedMatch[1] : trimmed;
  return parseIntegerId(rawThreadId);
}
