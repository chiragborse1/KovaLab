type FallbackAttemptLike = {
  provider?: unknown;
  model?: unknown;
  reason?: unknown;
};

type FallbackSummaryLike = {
  name?: unknown;
  attempts?: unknown;
  soonestCooldownExpiry?: unknown;
};

const TRANSIENT_FALLBACK_REASONS = new Set(["rate_limit", "overloaded"]);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) {
    return `~${seconds}s`;
  }
  return `~${Math.ceil(seconds / 60)} min`;
}

function asFallbackSummary(error: unknown): FallbackSummaryLike | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const record = error as FallbackSummaryLike;
  return record.name === "FallbackSummaryError" && Array.isArray(record.attempts) ? record : null;
}

function fallbackAttempts(summary: FallbackSummaryLike): FallbackAttemptLike[] {
  return Array.isArray(summary.attempts)
    ? summary.attempts.filter(
        (attempt): attempt is FallbackAttemptLike =>
          Boolean(attempt) && typeof attempt === "object",
      )
    : [];
}

function isTransientFallbackSummary(summary: FallbackSummaryLike): boolean {
  const attempts = fallbackAttempts(summary);
  return (
    attempts.length > 0 &&
    attempts.every(
      (attempt) =>
        typeof attempt.reason === "string" && TRANSIENT_FALLBACK_REASONS.has(attempt.reason),
    )
  );
}

function firstProvider(summary: FallbackSummaryLike): string | undefined {
  for (const attempt of fallbackAttempts(summary)) {
    if (typeof attempt.provider === "string" && attempt.provider.trim()) {
      return attempt.provider.trim();
    }
  }
  return undefined;
}

function formatFallbackSummary(summary: FallbackSummaryLike, nowMs: number): string | undefined {
  if (!isTransientFallbackSummary(summary)) {
    return undefined;
  }
  const expiry = summary.soonestCooldownExpiry;
  const provider = firstProvider(summary);
  const prefix = provider ? `${provider} is rate-limited` : "all selected models are rate-limited";
  if (typeof expiry === "number" && Number.isFinite(expiry) && expiry > nowMs) {
    return `${prefix} - ready in ${formatWait(expiry - nowMs)}. wait or switch with /models.`;
  }
  return `${prefix} right now. wait a few minutes or switch with /models.`;
}

function formatProviderCooldown(message: string): string | undefined {
  const match = /Provider\s+([^\s]+)\s+is in cooldown/i.exec(message);
  if (!match?.[1]) {
    return undefined;
  }
  return `${match[1]} is cooling down for this model. wait a few minutes or switch with /models.`;
}

export function formatTuiRunError(error: unknown, opts?: { nowMs?: number }): string {
  const summary = asFallbackSummary(error);
  const formattedSummary = summary
    ? formatFallbackSummary(summary, opts?.nowMs ?? Date.now())
    : undefined;
  if (formattedSummary) {
    return formattedSummary;
  }

  const message = errorMessage(error);
  return formatProviderCooldown(message) ?? message;
}
