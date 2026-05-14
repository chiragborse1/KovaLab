import { html, nothing } from "lit";
import { t, i18n, SUPPORTED_LOCALES, type Locale, isSupportedLocale } from "../../i18n/index.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";
import { icons } from "../icons.ts";
import type { UiSettings } from "../storage.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import { renderConnectCommand } from "./connect-command.ts";
import {
  resolveAuthHintKind,
  type PairingHint,
  resolvePairingHint,
  shouldShowInsecureContextHint,
} from "./overview-hints.ts";

export type GatewayAuthMode = "none" | "token" | "password" | "trusted-proxy";

export type ConnectionPanelProps = {
  connected: boolean;
  authMode?: GatewayAuthMode | null;
  settings: UiSettings;
  password: string;
  lastError: string | null;
  lastErrorCode: string | null;
  warnQueryToken: boolean;
  showGatewayToken: boolean;
  showGatewayPassword: boolean;
  onSettingsChange: (next: UiSettings) => void;
  onPasswordChange: (next: string) => void;
  onSessionKeyChange: (next: string) => void;
  onToggleGatewayTokenVisibility: () => void;
  onToggleGatewayPasswordVisibility: () => void;
  onConnect: () => void;
  onRefresh: () => void;
};

const PAIRING_HINT_COPY: Record<
  PairingHint["kind"],
  {
    titleKey: string | null;
    summaryKey: string | null;
  }
> = {
  "pairing-required": {
    titleKey: null,
    summaryKey: null,
  },
  "scope-upgrade-pending": {
    titleKey: "overview.pairing.scopeUpgradeTitle",
    summaryKey: "overview.pairing.scopeUpgradeSummary",
  },
  "role-upgrade-pending": {
    titleKey: "overview.pairing.roleUpgradeTitle",
    summaryKey: "overview.pairing.roleUpgradeSummary",
  },
  "metadata-upgrade-pending": {
    titleKey: "overview.pairing.metadataUpgradeTitle",
    summaryKey: "overview.pairing.metadataUpgradeSummary",
  },
};

function renderPairingHint(props: ConnectionPanelProps) {
  const pairingState = resolvePairingHint(props.connected, props.lastError, props.lastErrorCode);
  if (!pairingState) {
    return null;
  }
  const copy = PAIRING_HINT_COPY[pairingState.kind];
  const title = copy.titleKey ? t(copy.titleKey) : t("overview.pairing.hint");
  return html`
    <div class="muted" style="margin-top: 8px">
      ${title}
      ${copy.summaryKey ? html`<div style="margin-top: 6px">${t(copy.summaryKey)}</div>` : nothing}
      <div style="margin-top: 6px">
        ${pairingState.requestId
          ? html`<span class="mono">kova devices approve ${pairingState.requestId}</span><br />`
          : nothing}
        <span class="mono">kova devices list</span>
      </div>
      <div style="margin-top: 6px; font-size: 12px;">${t("overview.pairing.mobileHint")}</div>
      <div style="margin-top: 6px">
        <a
          class="session-link"
          href="https://docs.neuralstudio.in/web/control-ui#device-pairing-first-connection"
          target=${EXTERNAL_LINK_TARGET}
          rel=${buildExternalLinkRel()}
          title=${t("overview.pairing.docsTitle")}
          >${t("overview.pairing.docsLink")}</a
        >
      </div>
    </div>
  `;
}

function renderAuthHint(props: ConnectionPanelProps) {
  const authHintKind = resolveAuthHintKind({
    connected: props.connected,
    lastError: props.lastError,
    lastErrorCode: props.lastErrorCode,
    hasToken: Boolean(props.settings.token.trim()),
    hasPassword: Boolean(props.password.trim()),
  });
  if (authHintKind == null) {
    return null;
  }
  if (authHintKind === "required") {
    return html`
      <div class="muted" style="margin-top: 8px">
        ${t("overview.auth.required")}
        <div style="margin-top: 6px">
          <span class="mono">kova dashboard --no-open</span> → tokenized URL<br />
          <span class="mono">kova doctor --generate-gateway-token</span> → set token
        </div>
        <div style="margin-top: 6px">
          <a
            class="session-link"
            href="https://docs.neuralstudio.in/web/dashboard"
            target=${EXTERNAL_LINK_TARGET}
            rel=${buildExternalLinkRel()}
            title=${t("overview.connection.authDocsTitle")}
            >${t("overview.connection.authDocsLink")}</a
          >
        </div>
      </div>
    `;
  }
  return html`
    <div class="muted" style="margin-top: 8px">
      ${t("overview.auth.failed", { command: "kova dashboard --no-open" })}
      <div style="margin-top: 6px">
        <a
          class="session-link"
          href="https://docs.neuralstudio.in/web/dashboard"
          target=${EXTERNAL_LINK_TARGET}
          rel=${buildExternalLinkRel()}
          title=${t("overview.connection.authDocsTitle")}
          >${t("overview.connection.authDocsLink")}</a
        >
      </div>
    </div>
  `;
}

function renderInsecureContextHint(props: ConnectionPanelProps) {
  if (props.connected || !props.lastError) {
    return null;
  }
  const isSecureContext = typeof window !== "undefined" ? window.isSecureContext : true;
  if (isSecureContext) {
    return null;
  }
  if (!shouldShowInsecureContextHint(props.connected, props.lastError, props.lastErrorCode)) {
    return null;
  }
  return html`
    <div class="muted" style="margin-top: 8px">
      ${t("overview.insecure.hint", { url: "http://127.0.0.1:18789" })}
      <div style="margin-top: 6px">
        ${t("overview.insecure.stayHttp", {
          config: "gateway.controlUi.allowInsecureAuth: true",
        })}
      </div>
      <div style="margin-top: 6px">
        <a
          class="session-link"
          href="https://docs.neuralstudio.in/gateway/tailscale"
          target=${EXTERNAL_LINK_TARGET}
          rel=${buildExternalLinkRel()}
          title=${t("overview.connection.tailscaleDocsTitle")}
          >${t("overview.connection.tailscaleDocsLink")}</a
        >
        <span class="muted"> · </span>
        <a
          class="session-link"
          href="https://docs.neuralstudio.in/web/control-ui#insecure-http"
          target=${EXTERNAL_LINK_TARGET}
          rel=${buildExternalLinkRel()}
          title=${t("overview.connection.insecureHttpDocsTitle")}
          >${t("overview.connection.insecureHttpDocsLink")}</a
        >
      </div>
    </div>
  `;
}

function renderQueryTokenHint(props: ConnectionPanelProps) {
  if (props.connected || !props.lastError || !props.warnQueryToken) {
    return null;
  }
  const lower = normalizeLowercaseStringOrEmpty(props.lastError);
  const authFailed = lower.includes("unauthorized") || lower.includes("device identity required");
  if (!authFailed) {
    return null;
  }
  return html`
    <div class="muted" style="margin-top: 8px">
      Auth token must be passed as a URL fragment:
      <span class="mono">#token=&lt;token&gt;</span>. Query parameters (<span class="mono"
        >?token=</span
      >) may appear in server logs.
    </div>
  `;
}

export function renderConnectionPanel(props: ConnectionPanelProps) {
  const isTrustedProxy = props.authMode === "trusted-proxy";
  const currentLocale = isSupportedLocale(props.settings.locale)
    ? props.settings.locale
    : i18n.getLocale();

  return html`
    <div class="card control-panel-connection">
      <div class="card-title">${t("overview.access.title")}</div>
      <div class="card-sub">${t("overview.access.subtitle")}</div>
      <div class="ov-access-grid">
        <label class="field ov-access-grid__full">
          <span>${t("overview.access.wsUrl")}</span>
          <input
            .value=${props.settings.gatewayUrl}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onSettingsChange({
                ...props.settings,
                gatewayUrl: v,
                token: v.trim() === props.settings.gatewayUrl.trim() ? props.settings.token : "",
              });
            }}
            placeholder="ws://100.x.y.z:18789"
          />
        </label>
        ${isTrustedProxy
          ? ""
          : html`
              <label class="field">
                <span>${t("overview.access.token")}</span>
                <div class="ov-access-secret-row">
                  <input
                    type=${props.showGatewayToken ? "text" : "password"}
                    autocomplete="off"
                    .value=${props.settings.token}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onSettingsChange({ ...props.settings, token: v });
                    }}
                    placeholder="KOVA_GATEWAY_TOKEN"
                  />
                  <button
                    type="button"
                    class="btn btn--icon ${props.showGatewayToken ? "active" : ""}"
                    title=${props.showGatewayToken
                      ? t("overview.access.hideToken")
                      : t("overview.access.showToken")}
                    aria-label=${t("overview.access.toggleTokenVisibility")}
                    aria-pressed=${props.showGatewayToken}
                    @click=${props.onToggleGatewayTokenVisibility}
                  >
                    ${props.showGatewayToken ? icons.eye : icons.eyeOff}
                  </button>
                </div>
              </label>
              <label class="field">
                <span>${t("overview.access.password")}</span>
                <div class="ov-access-secret-row">
                  <input
                    type=${props.showGatewayPassword ? "text" : "password"}
                    autocomplete="off"
                    .value=${props.password}
                    @input=${(e: Event) => {
                      const v = (e.target as HTMLInputElement).value;
                      props.onPasswordChange(v);
                    }}
                    placeholder=${t("overview.access.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    class="btn btn--icon ${props.showGatewayPassword ? "active" : ""}"
                    title=${props.showGatewayPassword
                      ? t("overview.access.hidePassword")
                      : t("overview.access.showPassword")}
                    aria-label=${t("overview.access.togglePasswordVisibility")}
                    aria-pressed=${props.showGatewayPassword}
                    @click=${props.onToggleGatewayPasswordVisibility}
                  >
                    ${props.showGatewayPassword ? icons.eye : icons.eyeOff}
                  </button>
                </div>
              </label>
            `}
        <label class="field">
          <span>${t("overview.access.sessionKey")}</span>
          <input
            .value=${props.settings.sessionKey}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              props.onSessionKeyChange(v);
            }}
          />
        </label>
        <label class="field">
          <span>${t("overview.access.language")}</span>
          <select
            .value=${currentLocale}
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value as Locale;
              void i18n.setLocale(v);
              props.onSettingsChange({ ...props.settings, locale: v });
            }}
          >
            ${SUPPORTED_LOCALES.map((loc) => {
              const key = loc.replace(/-([a-zA-Z])/g, (_, c) => c.toUpperCase());
              return html`<option value=${loc} ?selected=${currentLocale === loc}>
                ${t(`languages.${key}`)}
              </option>`;
            })}
          </select>
        </label>
      </div>
      <div class="ov-access-actions">
        <button class="btn" @click=${() => props.onConnect()}>${t("common.connect")}</button>
        <button class="btn" @click=${() => props.onRefresh()}>${t("common.refresh")}</button>
        <span class="muted"
          >${isTrustedProxy
            ? t("overview.access.trustedProxy")
            : t("overview.access.connectHint")}</span
        >
      </div>
      ${!props.connected
        ? html`
            <div class="ov-access-note">
              <div>
                <strong>${t("overview.connection.title")}</strong>
                <span>${t("overview.connection.step2")}</span>
              </div>
              ${renderConnectCommand("kova dashboard")}
              <div class="ov-access-note__links">
                <a
                  class="session-link"
                  href="https://docs.neuralstudio.in/web/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  >${t("overview.connection.docsLink")}</a
                >
              </div>
            </div>
          `
        : nothing}
      ${props.lastError
        ? html`<div class="callout danger" style="margin-top: 14px;">
            <div>${props.lastError}</div>
            ${renderPairingHint(props) ?? ""} ${renderAuthHint(props) ?? ""}
            ${renderInsecureContextHint(props) ?? ""} ${renderQueryTokenHint(props) ?? ""}
          </div>`
        : nothing}
    </div>
  `;
}
