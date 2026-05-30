import { MAX_TIMER_TIMEOUT_MS } from "getkova/plugin-sdk/infra-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createZaloMock = vi.hoisted(() => vi.fn());

vi.mock("./zca-client.js", () => ({
  createZalo: createZaloMock,
  TextStyle: { Indent: 9 },
}));

import { logoutZaloProfile, startZaloQrLogin } from "./zalo-js.js";

describe("zalouser credential persistence", () => {
  beforeEach(() => {
    createZaloMock.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await logoutZaloProfile("qr-timeout-cap").catch(() => undefined);
  });

  it("caps oversized QR start timeout before computing the polling deadline", async () => {
    createZaloMock.mockResolvedValueOnce({
      loginQR: async () => new Promise(() => undefined),
    });
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(MAX_TIMER_TIMEOUT_MS + 1);

    const result = await startZaloQrLogin({
      profile: "qr-timeout-cap",
      timeoutMs: Number.MAX_SAFE_INTEGER,
    });

    expect(result.message).toBe("Still preparing QR. Call wait to continue checking login status.");
    expect(nowSpy).toHaveBeenCalledTimes(3);
  });
});
