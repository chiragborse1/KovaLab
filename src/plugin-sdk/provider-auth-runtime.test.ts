import { describe, expect, it } from "vitest";
import * as providerAuthRuntime from "./provider-auth-runtime.js";

describe("plugin-sdk provider-auth-runtime", () => {
  it("exports the runtime-ready auth helper", () => {
    expect(typeof providerAuthRuntime.getRuntimeAuthForModel).toBe("function");
  });

  it("exports OAuth callback helpers", () => {
    expect(typeof providerAuthRuntime.generateOAuthState).toBe("function");
    expect(typeof providerAuthRuntime.parseOAuthCallbackInput).toBe("function");
    expect(typeof providerAuthRuntime.parseOAuthAuthorizationInput).toBe("function");
    expect(typeof providerAuthRuntime.resolveOAuthTokenExpiresAt).toBe("function");
    expect(typeof providerAuthRuntime.resolveOAuthTokenLifetimeMs).toBe("function");
    expect(typeof providerAuthRuntime.waitForLocalOAuthCallback).toBe("function");
  });

  it("parses authorization code input from redirect URLs, query strings, and raw codes", () => {
    expect(
      providerAuthRuntime.parseOAuthAuthorizationInput(
        "http://localhost/callback?code=oauth-code&state=oauth-state",
      ),
    ).toEqual({ code: "oauth-code", state: "oauth-state" });
    expect(
      providerAuthRuntime.parseOAuthAuthorizationInput("code=oauth-code&state=oauth-state"),
    ).toEqual({
      code: "oauth-code",
      state: "oauth-state",
    });
    expect(providerAuthRuntime.parseOAuthAuthorizationInput("oauth-code#oauth-state")).toEqual({
      code: "oauth-code",
      state: "oauth-state",
    });
    expect(providerAuthRuntime.parseOAuthAuthorizationInput(" oauth-code ")).toEqual({
      code: "oauth-code",
    });
    expect(providerAuthRuntime.parseOAuthAuthorizationInput("   ")).toEqual({});
  });

  it("resolves safe OAuth token lifetimes and expiry timestamps", () => {
    expect(providerAuthRuntime.resolveOAuthTokenLifetimeMs("30")).toBe(30_000);
    expect(
      providerAuthRuntime.resolveOAuthTokenExpiresAt(30, {
        nowMs: 1_000,
        refreshSkewMs: 5_000,
      }),
    ).toBe(26_000);
  });

  it("rejects invalid OAuth token lifetimes", () => {
    expect(providerAuthRuntime.resolveOAuthTokenLifetimeMs(0)).toBeUndefined();
    expect(providerAuthRuntime.resolveOAuthTokenLifetimeMs(1.5)).toBeUndefined();
    expect(
      providerAuthRuntime.resolveOAuthTokenLifetimeMs(Number.MAX_SAFE_INTEGER),
    ).toBeUndefined();
    expect(
      providerAuthRuntime.resolveOAuthTokenExpiresAt(Number.MAX_SAFE_INTEGER, {
        nowMs: 1_000,
      }),
    ).toBeUndefined();
  });
});
