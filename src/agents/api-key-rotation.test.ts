import { describe, expect, it, vi } from "vitest";
import { executeWithApiKeyRotation } from "./api-key-rotation.js";

describe("executeWithApiKeyRotation", () => {
  it("retries transient same-key failures before returning success", async () => {
    const execute = vi
      .fn<(apiKey: string) => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(new Error("HTTP 503"), { status: 503 }))
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn(async () => {});

    await expect(
      executeWithApiKeyRotation({
        provider: "test-provider",
        apiKeys: ["primary"],
        execute,
        transientRetry: { attempts: 2, sleep },
      }),
    ).resolves.toBe("ok");

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, "primary");
    expect(execute).toHaveBeenNthCalledWith(2, "primary");
    expect(sleep).toHaveBeenCalledWith(250, undefined);
  });

  it("rotates keys on rate limits instead of retrying the same key", async () => {
    const execute = vi
      .fn<(apiKey: string) => Promise<string>>()
      .mockRejectedValueOnce(Object.assign(new Error("HTTP 429"), { status: 429 }))
      .mockResolvedValueOnce("rotated");
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();

    await expect(
      executeWithApiKeyRotation({
        provider: "test-provider",
        apiKeys: ["primary", "backup"],
        execute,
        onRetry,
        transientRetry: { attempts: 2, sleep },
      }),
    ).resolves.toBe("rotated");

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenNthCalledWith(1, "primary");
    expect(execute).toHaveBeenNthCalledWith(2, "backup");
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry non-transient provider failures", async () => {
    const error = Object.assign(new Error("HTTP 401 invalid api key"), { status: 401 });
    const execute = vi.fn<(apiKey: string) => Promise<string>>().mockRejectedValue(error);
    const sleep = vi.fn(async () => {});

    await expect(
      executeWithApiKeyRotation({
        provider: "test-provider",
        apiKeys: ["primary"],
        execute,
        transientRetry: { attempts: 3, sleep },
      }),
    ).rejects.toBe(error);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
