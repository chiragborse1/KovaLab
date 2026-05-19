import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalEmbeddingProvider, DEFAULT_LOCAL_MODEL } from "./embeddings.js";
import * as nodeLlamaModule from "./node-llama.js";

beforeEach(() => {
  vi.spyOn(nodeLlamaModule, "importNodeLlamaCpp");
});

afterEach(() => {
  vi.resetAllMocks();
});

function mockLocalEmbeddingRuntime(vector = new Float32Array([2.35, 3.45, 0.63, 4.3])) {
  const disposeContext = vi.fn();
  const disposeModel = vi.fn();
  const disposeLlama = vi.fn();
  const getEmbeddingFor = vi.fn().mockResolvedValue({ vector });
  const createEmbeddingContext = vi
    .fn()
    .mockResolvedValue({ getEmbeddingFor, dispose: disposeContext });
  const loadModel = vi.fn().mockResolvedValue({ createEmbeddingContext, dispose: disposeModel });
  const resolveModelFile = vi.fn(async (modelPath: string) => `/resolved/${modelPath}`);

  vi.mocked(nodeLlamaModule.importNodeLlamaCpp).mockResolvedValue({
    getLlama: async () => ({ loadModel, dispose: disposeLlama }),
    resolveModelFile,
    LlamaLogLevel: { error: 0 },
  } as never);

  return {
    createEmbeddingContext,
    disposeContext,
    disposeLlama,
    disposeModel,
    getEmbeddingFor,
    loadModel,
    resolveModelFile,
  };
}

describe("local embedding provider", () => {
  it("normalizes local embeddings and resolves the default local model", async () => {
    const runtime = mockLocalEmbeddingRuntime();

    const provider = await createLocalEmbeddingProvider({
      config: {} as never,
      provider: "local",
      model: "",
      fallback: "none",
    });

    const embedding = await provider.embedQuery("test query");
    const magnitude = Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0));

    expect(magnitude).toBeCloseTo(1, 5);
    expect(runtime.resolveModelFile).toHaveBeenCalledWith(
      DEFAULT_LOCAL_MODEL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(runtime.loadModel).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPath: `/resolved/${DEFAULT_LOCAL_MODEL}`,
        loadSignal: expect.any(AbortSignal),
      }),
    );
    expect(runtime.getEmbeddingFor).toHaveBeenCalledWith("test query");
  });

  it("passes default contextSize (4096) to createEmbeddingContext when not configured", async () => {
    const runtime = mockLocalEmbeddingRuntime();

    const provider = await createLocalEmbeddingProvider({
      config: {} as never,
      provider: "local",
      model: "",
      fallback: "none",
    });

    await provider.embedQuery("context size default test");

    expect(runtime.createEmbeddingContext).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: 4096, createSignal: expect.any(AbortSignal) }),
    );
  });

  it("passes configured contextSize to createEmbeddingContext", async () => {
    const runtime = mockLocalEmbeddingRuntime();

    const provider = await createLocalEmbeddingProvider({
      config: {} as never,
      provider: "local",
      model: "",
      fallback: "none",
      local: { contextSize: 2048 },
    });

    await provider.embedQuery("context size custom test");

    expect(runtime.createEmbeddingContext).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: 2048, createSignal: expect.any(AbortSignal) }),
    );
  });

  it('passes "auto" contextSize to createEmbeddingContext when explicitly set', async () => {
    const runtime = mockLocalEmbeddingRuntime();

    const provider = await createLocalEmbeddingProvider({
      config: {} as never,
      provider: "local",
      model: "",
      fallback: "none",
      local: { contextSize: "auto" },
    });

    await provider.embedQuery("context size auto test");

    expect(runtime.createEmbeddingContext).toHaveBeenCalledWith(
      expect.objectContaining({ contextSize: "auto", createSignal: expect.any(AbortSignal) }),
    );
  });

  it("trims explicit local model paths and cache directories", async () => {
    const runtime = mockLocalEmbeddingRuntime(new Float32Array([1, 0]));

    const provider = await createLocalEmbeddingProvider({
      config: {} as never,
      provider: "local",
      model: "",
      fallback: "none",
      local: {
        modelPath: "  /models/embed.gguf  ",
        modelCacheDir: "  /cache/models  ",
      },
    });

    await provider.embedBatch(["a", "b"]);

    expect(provider.model).toBe("/models/embed.gguf");
    expect(runtime.resolveModelFile).toHaveBeenCalledWith(
      "/models/embed.gguf",
      expect.objectContaining({
        directory: "/cache/models",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(runtime.getEmbeddingFor).toHaveBeenCalledTimes(2);
  });

  it("disposes cached local llama resources when closed", async () => {
    const runtime = mockLocalEmbeddingRuntime();

    const provider = await createLocalEmbeddingProvider({
      config: {} as never,
      provider: "local",
      model: "",
      fallback: "none",
    });

    await provider.embedQuery("load local resources");
    await provider.close?.();
    await provider.close?.();

    expect(runtime.disposeContext).toHaveBeenCalledTimes(1);
    expect(runtime.disposeModel).toHaveBeenCalledTimes(1);
    expect(runtime.disposeLlama).toHaveBeenCalledTimes(1);
    await expect(provider.embedQuery("after close")).rejects.toThrow(
      "Local embedding provider has been closed",
    );
  });
});
