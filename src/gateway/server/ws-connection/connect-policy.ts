import type { ConnectParams } from "../../protocol/index.js";
import type { GatewayRole } from "../../role-policy.js";
import { roleCanSkipDeviceIdentity } from "../../role-policy.js";

export type OperatorClientAuthPolicy = {
  isOperatorClient: boolean;
  allowInsecureAuthConfigured: boolean;
  allowBypass: boolean;
  device: ConnectParams["device"] | null | undefined;
};

export function resolveOperatorClientAuthPolicy(params: {
  isOperatorClient: boolean;
  deviceRaw: ConnectParams["device"] | null | undefined;
}): OperatorClientAuthPolicy {
  return {
    isOperatorClient: params.isOperatorClient,
    allowInsecureAuthConfigured: false,
    allowBypass: false,
    device: params.deviceRaw,
  };
}

export function shouldSkipOperatorClientPairing(
  policy: OperatorClientAuthPolicy,
  role: GatewayRole,
  trustedProxyAuthOk = false,
  authMode?: string,
  authMethod?: string,
): boolean {
  if (trustedProxyAuthOk) {
    return true;
  }
  if (
    policy.isOperatorClient &&
    role === "operator" &&
    authMethod === "tailscale" &&
    policy.device
  ) {
    return true;
  }
  // When auth is completely disabled (mode=none), there is no shared secret
  // or token to gate pairing. Requiring pairing in this configuration adds
  // friction without security value since any client can already connect
  // without credentials. Guard with policy.isOperatorClient because this function
  // is called for ALL clients at the call site.
  // Scope to operator role so node-role sessions still need device identity
  // (#43478 was reverted for skipping ALL clients).
  if (policy.isOperatorClient && role === "operator" && authMode === "none") {
    return true;
  }
  return role === "operator" && policy.allowBypass;
}

export function isTrustedProxyOperatorClientOperatorAuth(params: {
  isOperatorClient: boolean;
  role: GatewayRole;
  authMode: string;
  authOk: boolean;
  authMethod: string | undefined;
}): boolean {
  return (
    params.isOperatorClient &&
    params.role === "operator" &&
    params.authMode === "trusted-proxy" &&
    params.authOk &&
    params.authMethod === "trusted-proxy"
  );
}

export type MissingDeviceIdentityDecision =
  | { kind: "allow" }
  | { kind: "reject-operator-client-insecure-auth" }
  | { kind: "reject-unauthorized" }
  | { kind: "reject-device-required" };

export function shouldClearUnboundScopesForMissingDeviceIdentity(params: {
  decision: MissingDeviceIdentityDecision;
  operatorClientAuthPolicy: OperatorClientAuthPolicy;
  preserveInsecureLocalOperatorClientScopes: boolean;
  authMethod: string | undefined;
  trustedProxyAuthOk?: boolean;
}): boolean {
  return (
    params.decision.kind !== "allow" ||
    (!params.operatorClientAuthPolicy.allowBypass &&
      !params.preserveInsecureLocalOperatorClientScopes &&
      // trusted-proxy auth can bypass pairing for some clients, but those
      // self-declared scopes are still unbound without device identity.
      (params.authMethod === "token" ||
        params.authMethod === "password" ||
        params.authMethod === "trusted-proxy" ||
        params.trustedProxyAuthOk === true))
  );
}

export function evaluateMissingDeviceIdentity(params: {
  hasDeviceIdentity: boolean;
  role: GatewayRole;
  isOperatorClient: boolean;
  operatorClientAuthPolicy: OperatorClientAuthPolicy;
  trustedProxyAuthOk?: boolean;
  localBackendSelfPairingOk?: boolean;
  sharedAuthOk: boolean;
  authOk: boolean;
  hasSharedAuth: boolean;
  isLocalClient: boolean;
}): MissingDeviceIdentityDecision {
  if (params.hasDeviceIdentity) {
    return { kind: "allow" };
  }
  if (params.isOperatorClient && params.trustedProxyAuthOk) {
    return { kind: "allow" };
  }
  if (
    params.isOperatorClient &&
    params.operatorClientAuthPolicy.allowBypass &&
    params.role === "operator"
  ) {
    return { kind: "allow" };
  }
  if (params.localBackendSelfPairingOk && params.role === "operator") {
    return { kind: "allow" };
  }
  if (params.isOperatorClient && !params.operatorClientAuthPolicy.allowBypass) {
    if (!params.operatorClientAuthPolicy.allowInsecureAuthConfigured || !params.isLocalClient) {
      return { kind: "reject-operator-client-insecure-auth" };
    }
  }
  if (roleCanSkipDeviceIdentity(params.role, params.sharedAuthOk)) {
    return { kind: "allow" };
  }
  if (!params.authOk && params.hasSharedAuth) {
    return { kind: "reject-unauthorized" };
  }
  return { kind: "reject-device-required" };
}
