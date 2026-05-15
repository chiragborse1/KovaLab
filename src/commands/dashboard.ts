import { readConfigFileSnapshot, resolveGatewayPort } from "../config/config.js";
import { resolveGatewayAuthToken } from "../gateway/auth-token-resolution.js";
import { copyToClipboard } from "../infra/clipboard.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  resolveControlUiLinks,
} from "./onboard-helpers.js";

type DashboardOptions = {
  noOpen?: boolean;
};

function hasConfiguredDashboardSecret(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return Boolean(value && typeof value === "object");
}

function resolveDashboardAuthMode(cfg: { gateway?: unknown }): string {
  const gateway =
    cfg.gateway && typeof cfg.gateway === "object" ? (cfg.gateway as Record<string, unknown>) : {};
  const auth =
    gateway.auth && typeof gateway.auth === "object"
      ? (gateway.auth as Record<string, unknown>)
      : {};
  const mode = typeof auth.mode === "string" ? auth.mode.trim() : "";
  if (mode) {
    return mode;
  }
  if (hasConfiguredDashboardSecret(auth.password) && !hasConfiguredDashboardSecret(auth.token)) {
    return "password";
  }
  if (hasConfiguredDashboardSecret(auth.token)) {
    return "token";
  }
  return "";
}

export async function dashboardCommand(
  runtime: RuntimeEnv = defaultRuntime,
  options: DashboardOptions = {},
) {
  const snapshot = await readConfigFileSnapshot();
  const cfg = snapshot.valid ? (snapshot.sourceConfig ?? snapshot.config) : {};
  const port = resolveGatewayPort(cfg);
  const bind = cfg.gateway?.bind ?? "loopback";
  const basePath = cfg.gateway?.controlUi?.basePath;
  const customBindHost = cfg.gateway?.customBindHost;
  const authMode = resolveDashboardAuthMode(cfg);
  const tokenAuthActive = authMode === "token";
  const resolvedToken: Awaited<ReturnType<typeof resolveGatewayAuthToken>> = tokenAuthActive
    ? await resolveGatewayAuthToken({
        cfg,
        env: process.env,
        envFallback: "always",
      })
    : { secretRefConfigured: false };
  const token = resolvedToken.token ?? "";

  // LAN URLs fail secure-context checks in browsers.
  // Coerce only lan->loopback and preserve other bind modes.
  const links = resolveControlUiLinks({
    port,
    bind: bind === "lan" ? "loopback" : bind,
    customBindHost,
    basePath,
    tlsEnabled: cfg.gateway?.tls?.enabled === true,
  });
  // Avoid embedding externally managed SecretRef tokens in terminal/clipboard/browser args.
  const includeTokenInUrl = token.length > 0 && !resolvedToken.secretRefConfigured;
  // Prefer URL fragment to avoid leaking auth tokens via query params.
  const dashboardUrl = includeTokenInUrl
    ? `${links.httpUrl}#token=${encodeURIComponent(token)}`
    : links.httpUrl;

  runtime.log(`Dashboard URL: ${links.httpUrl}`);
  if (includeTokenInUrl) {
    runtime.log("Token auto-auth included in browser/clipboard URL.");
  }
  if (authMode === "password") {
    runtime.log(
      "Gateway uses password auth; token auto-auth disabled. Enter the gateway password in Control UI settings.",
    );
  } else if (authMode && authMode !== "token") {
    runtime.log(`Gateway auth mode is ${authMode}; token auto-auth disabled.`);
  }
  if (resolvedToken.secretRefConfigured && token) {
    runtime.log(
      "Token auto-auth is disabled for SecretRef-managed gateway.auth.token; use your external token source if prompted.",
    );
  }
  if (resolvedToken.unresolvedRefReason) {
    runtime.log(`Token auto-auth unavailable: ${resolvedToken.unresolvedRefReason}`);
    runtime.log(
      "Set KOVA_GATEWAY_TOKEN in this shell or resolve your secret provider, then rerun `kova dashboard`.",
    );
  }

  const copied = await copyToClipboard(dashboardUrl).catch(() => false);
  runtime.log(copied ? "Copied to clipboard." : "Copy to clipboard unavailable.");

  let opened = false;
  let hint: string | undefined;
  if (!options.noOpen) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      opened = await openUrl(dashboardUrl);
    }
    if (!opened) {
      hint = formatControlUiSshHint({
        port,
        basePath,
      });
    }
  } else {
    hint =
      copied && includeTokenInUrl
        ? "Browser launch disabled (--no-open). Token-authenticated URL copied to clipboard."
        : "Browser launch disabled (--no-open). Use the URL above.";
  }

  if (opened) {
    runtime.log("Opened in your browser. Keep that tab to control Kova.");
  } else if (hint) {
    runtime.log(hint);
  }
}
