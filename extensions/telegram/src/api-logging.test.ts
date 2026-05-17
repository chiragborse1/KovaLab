import { describe, expect, it, vi } from "vitest";
import {
  isExpiredTelegramCallbackQueryAckError,
  withTelegramApiErrorLogging,
} from "./api-logging.js";

function createExpiredCallbackQueryError() {
  return Object.assign(
    new Error(
      "Call to 'answerCallbackQuery' failed! (400: Bad Request: query is too old and response timeout expired or query ID is invalid)",
    ),
    {
      name: "GrammyError",
      method: "answerCallbackQuery",
      error_code: 400,
      description:
        "Bad Request: query is too old and response timeout expired or query ID is invalid",
    },
  );
}

describe("withTelegramApiErrorLogging", () => {
  it("can suppress expired callback acknowledgement errors", async () => {
    const err = createExpiredCallbackQueryError();
    const logger = vi.fn();

    await expect(
      withTelegramApiErrorLogging({
        operation: "answerCallbackQuery",
        logger,
        shouldLog: (candidate) => !isExpiredTelegramCallbackQueryAckError(candidate),
        fn: async () => {
          throw err;
        },
      }),
    ).rejects.toBe(err);

    expect(logger).not.toHaveBeenCalled();
  });

  it("still logs unexpected callback acknowledgement errors", async () => {
    const err = Object.assign(
      new Error("Call to 'answerCallbackQuery' failed! (500: Internal Server Error)"),
      {
        name: "GrammyError",
        method: "answerCallbackQuery",
        error_code: 500,
        description: "Internal Server Error",
      },
    );
    const logger = vi.fn();

    await expect(
      withTelegramApiErrorLogging({
        operation: "answerCallbackQuery",
        logger,
        shouldLog: (candidate) => !isExpiredTelegramCallbackQueryAckError(candidate),
        fn: async () => {
          throw err;
        },
      }),
    ).rejects.toBe(err);

    expect(logger).toHaveBeenCalledWith(
      "telegram answerCallbackQuery failed: Call to 'answerCallbackQuery' failed! (500: Internal Server Error)",
    );
  });
});
