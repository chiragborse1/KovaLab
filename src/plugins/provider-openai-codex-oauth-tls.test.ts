import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_TIMER_TIMEOUT_MS } from "../shared/number-coercion.js";
import { runOpenAIOAuthTlsPreflight } from "./provider-openai-codex-oauth-tls.js";

describe("runOpenAIOAuthTlsPreflight", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caps oversized TLS preflight timeouts before creating an abort signal", async () => {
    const signal = AbortSignal.abort();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302 }));

    await expect(
      runOpenAIOAuthTlsPreflight({
        timeoutMs: Number.MAX_SAFE_INTEGER,
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: true });

    expect(timeoutSpy).toHaveBeenCalledWith(MAX_TIMER_TIMEOUT_MS);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
