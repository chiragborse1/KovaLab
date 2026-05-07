import { html } from "lit";
import { t } from "../../i18n/index.ts";
import type { AppViewState } from "../app-view-state.ts";
import { icons } from "../icons.ts";
import { normalizeBasePath } from "../navigation.ts";
import { agentLogoUrl } from "./agents-utils.ts";

export function renderLoginGate(state: AppViewState) {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconSrc = agentLogoUrl(basePath);

  return html`
    <div class="login-gate">
      <div class="login-gate__orb login-gate__orb--one"></div>
      <div class="login-gate__orb login-gate__orb--two"></div>
      <div class="login-gate__shell">
        <section class="login-gate__hero" aria-label=${t("login.heroAria")}>
          <div class="login-gate__brand">
            <span class="login-gate__brand-mark">
              <img class="login-gate__logo" src=${faviconSrc} alt="Kova" />
            </span>
            <span>${t("login.brand")}</span>
          </div>
          <div class="login-gate__hero-copy">
            <h1>${t("login.headline")}</h1>
            <p>${t("login.description")}</p>
          </div>
          <div class="login-gate__visual" aria-hidden="true">
            <div class="login-gate__visual-ring login-gate__visual-ring--outer"></div>
            <div class="login-gate__visual-ring login-gate__visual-ring--inner"></div>
            <img class="login-gate__visual-logo" src=${faviconSrc} alt="" />
            <div class="login-gate__signal login-gate__signal--one">
              ${icons.radio}<span>${t("login.visualGateway")}</span>
            </div>
            <div class="login-gate__signal login-gate__signal--two">
              ${icons.terminal}<span>${t("login.visualSession")}</span>
            </div>
            <div class="login-gate__signal login-gate__signal--three">
              ${icons.globe}<span>${t("login.visualDashboard")}</span>
            </div>
          </div>
          <div class="login-gate__trust-list" aria-label=${t("login.trustAria")}>
            <span>${t("login.trustLocal")}</span>
            <span>${t("login.trustAuth")}</span>
            <span>${t("login.trustNetwork")}</span>
          </div>
        </section>

        <div class="login-gate__card">
          <div class="login-gate__header">
            <div class="login-gate__title">${t("login.panelTitle")}</div>
            <div class="login-gate__sub">${t("login.panelSubtitle")}</div>
          </div>
          <div class="login-gate__form">
            <label class="field">
              <span>${t("overview.access.wsUrl")}</span>
              <input
                .value=${state.settings.gatewayUrl}
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  state.applySettings({ ...state.settings, gatewayUrl: v });
                }}
                placeholder="ws://127.0.0.1:18789"
              />
            </label>
            <label class="field">
              <span>${t("overview.access.token")}</span>
              <div class="login-gate__secret-row">
                <input
                  type=${state.loginShowGatewayToken ? "text" : "password"}
                  autocomplete="off"
                  spellcheck="false"
                  .value=${state.settings.token}
                  @input=${(e: Event) => {
                    const v = (e.target as HTMLInputElement).value;
                    state.applySettings({ ...state.settings, token: v });
                  }}
                  placeholder="KOVA_GATEWAY_TOKEN (${t("login.passwordPlaceholder")})"
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === "Enter") {
                      state.connect();
                    }
                  }}
                />
                <button
                  type="button"
                  class="btn btn--icon ${state.loginShowGatewayToken ? "active" : ""}"
                  title=${state.loginShowGatewayToken ? t("login.hideToken") : t("login.showToken")}
                  aria-label=${t("login.toggleTokenVisibility")}
                  aria-pressed=${state.loginShowGatewayToken}
                  @click=${() => {
                    state.loginShowGatewayToken = !state.loginShowGatewayToken;
                  }}
                >
                  ${state.loginShowGatewayToken ? icons.eye : icons.eyeOff}
                </button>
              </div>
            </label>
            <label class="field">
              <span>${t("overview.access.password")}</span>
              <div class="login-gate__secret-row">
                <input
                  type=${state.loginShowGatewayPassword ? "text" : "password"}
                  autocomplete="off"
                  spellcheck="false"
                  .value=${state.password}
                  @input=${(e: Event) => {
                    const v = (e.target as HTMLInputElement).value;
                    state.password = v;
                  }}
                  placeholder="${t("login.passwordPlaceholder")}"
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === "Enter") {
                      state.connect();
                    }
                  }}
                />
                <button
                  type="button"
                  class="btn btn--icon ${state.loginShowGatewayPassword ? "active" : ""}"
                  title=${state.loginShowGatewayPassword
                    ? t("login.hidePassword")
                    : t("login.showPassword")}
                  aria-label=${t("login.togglePasswordVisibility")}
                  aria-pressed=${state.loginShowGatewayPassword}
                  @click=${() => {
                    state.loginShowGatewayPassword = !state.loginShowGatewayPassword;
                  }}
                >
                  ${state.loginShowGatewayPassword ? icons.eye : icons.eyeOff}
                </button>
              </div>
            </label>
            <button class="btn primary login-gate__connect" @click=${() => state.connect()}>
              ${t("common.connect")}
            </button>
          </div>
          ${state.lastError
            ? html`<div class="callout danger login-gate__error">
                <div>${state.lastError}</div>
              </div>`
            : ""}
          <div class="login-gate__quick-note">
            <span>${t("login.quickHint")}</span>
            <a
              class="session-link"
              href="https://docs.neuralstudio.in/web/dashboard"
              target="_blank"
              rel="noreferrer"
              >${t("overview.connection.docsLink")}</a
            >
          </div>
        </div>
      </div>
    </div>
  `;
}
