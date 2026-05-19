import { describe, expect, it } from "vitest";
import {
  resolveEmbeddingTimeoutMs,
  resolveMemoryIndexConcurrency,
  runEmbeddingOperationWithTimeout,
} from "./manager-embedding-ops.js";

describe("memory embedding timeout resolution", () => {
  it("uses hosted defaults for inline embedding calls", () => {
    expect(resolveEmbeddingTimeoutMs({ kind: "query", providerId: "openai" })).toBe(60_000);
    expect(resolveEmbeddingTimeoutMs({ kind: "batch", providerId: "openai" })).toBe(120_000);
  });

  it("uses local defaults for the builtin local provider", () => {
    expect(resolveEmbeddingTimeoutMs({ kind: "query", providerId: "local" })).toBe(300_000);
    expect(resolveEmbeddingTimeoutMs({ kind: "batch", providerId: "local" })).toBe(600_000);
  });

  it("uses runtime batch defaults for local-server providers", () => {
    expect(
      resolveEmbeddingTimeoutMs({
        kind: "batch",
        providerId: "ollama",
        providerRuntime: { inlineBatchTimeoutMs: 600_000 },
      }),
    ).toBe(600_000);
  });

  it("lets configured batch timeout override provider defaults", () => {
    expect(
      resolveEmbeddingTimeoutMs({
        kind: "batch",
        providerId: "ollama",
        providerRuntime: { inlineBatchTimeoutMs: 600_000 },
        configuredBatchTimeoutSeconds: 45,
      }),
    ).toBe(45_000);
  });
});

describe("memory embedding timeout abort", () => {
  it("aborts the provider operation when the timeout fires", async () => {
    let signalSeen: AbortSignal | undefined;

    await expect(
      runEmbeddingOperationWithTimeout({
        timeoutMs: 1,
        message: "memory embeddings query timed out after 0s",
        run: async (signal) => {
          signalSeen = signal;
          return await new Promise<number[]>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          });
        },
      }),
    ).rejects.toThrow("memory embeddings query timed out after 0s");

    expect(signalSeen?.aborted).toBe(true);
  });

  it("keeps the timeout error when a provider abort listener rejects generically", async () => {
    await expect(
      runEmbeddingOperationWithTimeout({
        timeoutMs: 1,
        message: "memory embeddings batch timed out after 0s",
        run: async (signal) =>
          await new Promise<number[]>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("provider aborted")), {
              once: true,
            });
          }),
      }),
    ).rejects.toThrow("memory embeddings batch timed out after 0s");
  });
});

describe("memory index concurrency resolution", () => {
  it("uses the default index concurrency when batch mode is disabled and unconfigured", () => {
    expect(
      resolveMemoryIndexConcurrency({
        batch: { enabled: false, concurrency: 2 },
      }),
    ).toBe(4);
  });

  it("respects configured concurrency even when batch mode is disabled", () => {
    expect(
      resolveMemoryIndexConcurrency({
        batch: { enabled: false, concurrency: 1 },
        configuredConcurrency: 1,
      }),
    ).toBe(1);
  });

  it("uses resolved batch concurrency when batch mode is enabled", () => {
    expect(
      resolveMemoryIndexConcurrency({
        batch: { enabled: true, concurrency: 3 },
      }),
    ).toBe(3);
  });
});
