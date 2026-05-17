import { createSubsystemLogger } from "getkova/plugin-sdk/runtime-env";
import type { RuntimeEnv } from "getkova/plugin-sdk/runtime-env";
import { formatErrorMessage } from "getkova/plugin-sdk/ssrf-runtime";

export type TelegramApiLogger = (message: string) => void;

type TelegramApiLoggingParams<T> = {
  operation: string;
  fn: () => Promise<T>;
  runtime?: RuntimeEnv;
  logger?: TelegramApiLogger;
  shouldLog?: (err: unknown) => boolean;
};

const fallbackLogger = createSubsystemLogger("telegram/api");
const EXPIRED_CALLBACK_QUERY_MESSAGE_RE =
  /query is too old|response timeout expired|query id is invalid/i;

function readStringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw : undefined;
}

function readNumberProperty(value: unknown, key: string): number | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function resolveTelegramApiLogger(runtime?: RuntimeEnv, logger?: TelegramApiLogger) {
  if (logger) {
    return logger;
  }
  if (runtime?.error) {
    return runtime.error;
  }
  return (message: string) => fallbackLogger.error(message);
}

export function isExpiredTelegramCallbackQueryAckError(err: unknown): boolean {
  const method = readStringProperty(err, "method");
  const description = readStringProperty(err, "description");
  const code = readNumberProperty(err, "error_code");
  const message = formatErrorMessage(err);
  const methodMatches =
    method === "answerCallbackQuery" || /\banswerCallbackQuery\b/i.test(message);
  const codeMatches = code === 400 || message.includes("(400:");
  const expiredMatches =
    EXPIRED_CALLBACK_QUERY_MESSAGE_RE.test(description ?? "") ||
    EXPIRED_CALLBACK_QUERY_MESSAGE_RE.test(message);

  return methodMatches && codeMatches && expiredMatches;
}

export async function withTelegramApiErrorLogging<T>({
  operation,
  fn,
  runtime,
  logger,
  shouldLog,
}: TelegramApiLoggingParams<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!shouldLog || shouldLog(err)) {
      const errText = formatErrorMessage(err);
      const log = resolveTelegramApiLogger(runtime, logger);
      log(`telegram ${operation} failed: ${errText}`);
    }
    throw err;
  }
}
