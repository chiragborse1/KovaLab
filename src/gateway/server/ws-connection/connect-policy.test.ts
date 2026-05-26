import { describe, expect, test } from "vitest";
import {
  evaluateMissingDeviceIdentity,
  isTrustedProxyOperatorClientOperatorAuth,
  resolveOperatorClientAuthPolicy,
  shouldClearUnboundScopesForMissingDeviceIdentity,
  shouldSkipOperatorClientPairing,
} from "./connect-policy.js";

const device = {
  id: "dev-1",
  publicKey: "pk",
  signature: "sig",
  signedAt: Date.now(),
  nonce: "nonce-1",
};

describe("ws connect policy", () => {
  test("resolves operator UI auth policy without removed browser bypasses", () => {
    const policy = resolveOperatorClientAuthPolicy({
      isOperatorClient: true,
      deviceRaw: device,
    });

    expect(policy.isOperatorClient).toBe(true);
    expect(policy.allowBypass).toBe(false);
    expect(policy.allowInsecureAuthConfigured).toBe(false);
    expect(policy.device?.id).toBe("dev-1");
  });

  test("evaluates missing-device decisions", () => {
    const nonUi = resolveOperatorClientAuthPolicy({
      isOperatorClient: false,
      deviceRaw: null,
    });
    const operatorClient = resolveOperatorClientAuthPolicy({
      isOperatorClient: true,
      deviceRaw: null,
    });

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: true,
        role: "node",
        isOperatorClient: false,
        operatorClientAuthPolicy: nonUi,
        trustedProxyAuthOk: false,
        sharedAuthOk: true,
        authOk: true,
        hasSharedAuth: true,
        isLocalClient: false,
      }).kind,
    ).toBe("allow");

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: false,
        role: "operator",
        isOperatorClient: false,
        operatorClientAuthPolicy: nonUi,
        localBackendSelfPairingOk: true,
        trustedProxyAuthOk: false,
        sharedAuthOk: false,
        authOk: false,
        hasSharedAuth: false,
        isLocalClient: true,
      }).kind,
    ).toBe("allow");

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: false,
        role: "operator",
        isOperatorClient: true,
        operatorClientAuthPolicy: operatorClient,
        trustedProxyAuthOk: true,
        sharedAuthOk: false,
        authOk: true,
        hasSharedAuth: false,
        isLocalClient: false,
      }).kind,
    ).toBe("allow");

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: false,
        role: "operator",
        isOperatorClient: true,
        operatorClientAuthPolicy: operatorClient,
        trustedProxyAuthOk: false,
        sharedAuthOk: true,
        authOk: true,
        hasSharedAuth: true,
        isLocalClient: true,
      }).kind,
    ).toBe("reject-operator-client-insecure-auth");

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: false,
        role: "node",
        isOperatorClient: false,
        operatorClientAuthPolicy: nonUi,
        trustedProxyAuthOk: false,
        sharedAuthOk: true,
        authOk: true,
        hasSharedAuth: true,
        isLocalClient: false,
      }).kind,
    ).toBe("reject-device-required");

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: false,
        role: "node",
        isOperatorClient: false,
        operatorClientAuthPolicy: nonUi,
        trustedProxyAuthOk: false,
        sharedAuthOk: false,
        authOk: false,
        hasSharedAuth: true,
        isLocalClient: false,
      }).kind,
    ).toBe("reject-unauthorized");

    expect(
      evaluateMissingDeviceIdentity({
        hasDeviceIdentity: false,
        role: "operator",
        isOperatorClient: false,
        operatorClientAuthPolicy: nonUi,
        trustedProxyAuthOk: false,
        sharedAuthOk: false,
        authOk: true,
        hasSharedAuth: false,
        isLocalClient: false,
      }).kind,
    ).toBe("reject-device-required");
  });

  test("skips pairing for explicit trusted operator cases only", () => {
    const operatorClientWithDevice = resolveOperatorClientAuthPolicy({
      isOperatorClient: true,
      deviceRaw: device,
    });
    const operatorClientWithoutDevice = resolveOperatorClientAuthPolicy({
      isOperatorClient: true,
      deviceRaw: null,
    });
    const nonUiWithDevice = resolveOperatorClientAuthPolicy({
      isOperatorClient: false,
      deviceRaw: device,
    });

    expect(
      shouldSkipOperatorClientPairing(operatorClientWithoutDevice, "operator", false, "none"),
    ).toBe(true);
    expect(
      shouldSkipOperatorClientPairing(operatorClientWithoutDevice, "node", false, "none"),
    ).toBe(false);
    expect(shouldSkipOperatorClientPairing(nonUiWithDevice, "operator", false, "none")).toBe(false);
    expect(
      shouldSkipOperatorClientPairing(
        operatorClientWithDevice,
        "operator",
        false,
        "token",
        "tailscale",
      ),
    ).toBe(true);
    expect(
      shouldSkipOperatorClientPairing(
        operatorClientWithoutDevice,
        "operator",
        false,
        "token",
        "tailscale",
      ),
    ).toBe(false);
    expect(
      shouldSkipOperatorClientPairing(
        operatorClientWithDevice,
        "node",
        false,
        "token",
        "tailscale",
      ),
    ).toBe(false);
    expect(
      shouldSkipOperatorClientPairing(
        operatorClientWithDevice,
        "operator",
        true,
        "token",
        "trusted-proxy",
      ),
    ).toBe(true);
  });

  test("detects trusted-proxy operator UI auth", () => {
    expect(
      isTrustedProxyOperatorClientOperatorAuth({
        isOperatorClient: true,
        role: "operator",
        authMode: "trusted-proxy",
        authOk: true,
        authMethod: "trusted-proxy",
      }),
    ).toBe(true);
    expect(
      isTrustedProxyOperatorClientOperatorAuth({
        isOperatorClient: false,
        role: "operator",
        authMode: "trusted-proxy",
        authOk: true,
        authMethod: "trusted-proxy",
      }),
    ).toBe(false);
    expect(
      isTrustedProxyOperatorClientOperatorAuth({
        isOperatorClient: true,
        role: "node",
        authMode: "trusted-proxy",
        authOk: true,
        authMethod: "trusted-proxy",
      }),
    ).toBe(false);
  });

  test("clears unbound scopes unless a caller explicitly preserves them", () => {
    const policy = resolveOperatorClientAuthPolicy({
      isOperatorClient: false,
      deviceRaw: null,
    });

    expect(
      shouldClearUnboundScopesForMissingDeviceIdentity({
        decision: { kind: "allow" },
        operatorClientAuthPolicy: policy,
        preserveInsecureLocalOperatorClientScopes: false,
        authMethod: "token",
      }),
    ).toBe(true);
    expect(
      shouldClearUnboundScopesForMissingDeviceIdentity({
        decision: { kind: "allow" },
        operatorClientAuthPolicy: policy,
        preserveInsecureLocalOperatorClientScopes: false,
        authMethod: undefined,
        trustedProxyAuthOk: true,
      }),
    ).toBe(true);
    expect(
      shouldClearUnboundScopesForMissingDeviceIdentity({
        decision: { kind: "allow" },
        operatorClientAuthPolicy: policy,
        preserveInsecureLocalOperatorClientScopes: true,
        authMethod: "token",
      }),
    ).toBe(false);
    expect(
      shouldClearUnboundScopesForMissingDeviceIdentity({
        decision: { kind: "reject-device-required" },
        operatorClientAuthPolicy: policy,
        preserveInsecureLocalOperatorClientScopes: false,
        authMethod: undefined,
      }),
    ).toBe(true);
  });
});
