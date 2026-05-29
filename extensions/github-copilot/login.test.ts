import { afterEach, describe, expect, it, vi } from "vitest";
import { testing } from "./login.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub Copilot login", () => {
  it("rejects unsafe device code lifetimes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            '{"device_code":"device-code","user_code":"ABCD-1234","verification_uri":"https://github.com/login/device","interval":0,"expires_in":1e309}',
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    await expect(testing.requestDeviceCode({ scope: "read:user" })).rejects.toThrow(
      "GitHub device code response missing fields",
    );
  });

  it("accepts zero polling intervals and clamps later before polling", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              device_code: "device-code",
              user_code: "ABCD-1234",
              verification_uri: "https://github.com/login/device",
              interval: 0,
              expires_in: 900,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const result = await testing.requestDeviceCode({ scope: "read:user" });

    expect(result.intervalMs).toBe(0);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });
});
