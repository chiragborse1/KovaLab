import { html, nothing, type TemplateResult } from "lit";
import type {
  ControlWizardCompletedStep,
  ControlWizardSection,
  ControlWizardStatus,
  ControlWizardStep,
  ControlWizardStepOption,
} from "../controllers/wizard.ts";
import { icons } from "../icons.ts";

export type ControlPanelProps = {
  connected: boolean;
  gatewayUrl: string;
  assistantName: string;
  version: string;
  configPath?: string | null;
  wizardLoading: boolean;
  wizardSessionId: string | null;
  wizardStep: ControlWizardStep | null;
  wizardStatus: ControlWizardStatus | null;
  wizardError: string | null;
  wizardAnswerValue: unknown;
  wizardCompletedSteps: ControlWizardCompletedStep[];
  wizardActiveSection: ControlWizardSection | null;
  wizardStepStartedAt: number | null;
  onWizardStart: (mode: "local" | "remote") => void;
  onWizardStartSection: (section: ControlWizardSection) => void;
  onWizardAnswerChange: (value: unknown) => void;
  onWizardSubmit: (value?: unknown) => void;
  onWizardCancel: () => void;
  onWizardRefresh: () => void;
};

const SETUP_STEPS = [
  {
    label: "Existing config",
    section: "health",
  },
  {
    label: "Model provider",
    section: "model",
  },
  {
    label: "Workspace",
    section: "workspace",
  },
  {
    label: "Gateway",
    section: "gateway",
  },
  {
    label: "Channels",
    section: "channels",
  },
  {
    label: "Web search",
    section: "web",
  },
  {
    label: "Service",
    section: "daemon",
  },
  {
    label: "Skills & health",
    section: "skills",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  section: ControlWizardSection;
}>;

type WizardOptionKind = "provider" | "model" | "default";

type ProviderLogo = {
  label: string;
  className: string;
};

function renderGatewayStatus(props: ControlPanelProps) {
  return html`
    <div class="control-panel-hero__status ${props.connected ? "is-ok" : "is-off"}">
      <span class="statusDot ${props.connected ? "ok" : "error"}"></span>
      ${props.connected ? "Gateway connected" : "Gateway disconnected"}
    </div>
  `;
}

function renderSetupTimeline(props: ControlPanelProps) {
  const hasActiveWizard = Boolean(props.wizardSessionId);
  return html`
    <aside class="control-panel-nav" aria-label="Setup steps">
      <div class="control-panel-nav__title">Onboarding flow</div>
      ${SETUP_STEPS.map(
        (step, index) => html`
          <button
            class="control-panel-step ${props.wizardActiveSection === step.section
              ? "is-active"
              : ""}"
            title=${hasActiveWizard
              ? "Finish or cancel the current setup step before opening another section."
              : ""}
            ?disabled=${!props.connected || props.wizardLoading || hasActiveWizard}
            @click=${() => props.onWizardStartSection(step.section)}
          >
            <span class="control-panel-step__index">${index + 1}</span>
            <span>
              <strong>${step.label}</strong>
            </span>
          </button>
        `,
      )}
    </aside>
  `;
}

function formatCompletedValue(step: ControlWizardStep, value: unknown): string {
  if (step.sensitive) {
    return value === null || value === undefined || value === "" ? "Not set" : "Saved securely";
  }
  if (step.type === "confirm") {
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "None";
    }
    const labels = value.map((entry) => optionLabelForValue(step, entry));
    return labels.join(", ");
  }
  return optionLabelForValue(step, value);
}

function optionLabelForValue(step: ControlWizardStep, value: unknown): string {
  const option = (step.options ?? []).find((candidate) => valuesEqual(candidate.value, value));
  if (option) {
    return option.label;
  }
  if (value === null || value === undefined || value === "") {
    return "Empty";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return valueKey(value);
}

function completedStepTitle(step: ControlWizardStep): string {
  return step.title ?? step.message ?? "Setup step";
}

function renderCompletedWizardSteps(steps: ControlWizardCompletedStep[]) {
  if (steps.length === 0) {
    return nothing;
  }
  return html`
    <div class="control-panel-completed-flow" aria-label="Completed setup answers">
      ${steps.map(
        ({ step, value }, index) => html`
          <div class="control-panel-completed-step">
            <span class="control-panel-completed-step__index">${index + 1}</span>
            <div>
              <strong>${completedStepTitle(step)}</strong>
              <small>${formatCompletedValue(step, value)}</small>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

function setupSummaryRequiresRestart(steps: ControlWizardCompletedStep[]): boolean {
  return steps.some(({ step }) => {
    const text = `${step.title ?? ""} ${step.message ?? ""}`.toLowerCase();
    return (
      text.includes("gateway") ||
      text.includes("auth") ||
      text.includes("bind") ||
      text.includes("port") ||
      text.includes("service") ||
      text.includes("daemon")
    );
  });
}

function renderSectionHeader(params: { icon: TemplateResult; title: string; detail: string }) {
  return html`
    <div class="control-panel-section__head">
      <div class="control-panel-section__title-row">
        <span class="control-panel-section__icon">${params.icon}</span>
        <div>
          <h2>${params.title}</h2>
          <p>${params.detail}</p>
        </div>
      </div>
    </div>
    <div class="control-panel-section__rule"></div>
  `;
}

function valueKey(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return valueKey(left) === valueKey(right);
}

function normalizeOptionText(option: ControlWizardStepOption): string {
  return `${option.label} ${typeof option.value === "string" ? option.value : valueKey(option.value)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function providerLogoForOption(option: ControlWizardStepOption): ProviderLogo | null {
  const text = normalizeOptionText(option);
  const entries: Array<[RegExp, ProviderLogo]> = [
    [/openrouter/, { label: "OR", className: "openrouter" }],
    [/openai codex|codex/, { label: "CX", className: "codex" }],
    [/openai|gpt/, { label: "AI", className: "openai" }],
    [/anthropic|claude/, { label: "AN", className: "anthropic" }],
    [/google|gemini/, { label: "GO", className: "google" }],
    [/github|copilot/, { label: "GH", className: "github" }],
    [/ollama/, { label: "OL", className: "ollama" }],
    [/groq/, { label: "GQ", className: "groq" }],
    [/mistral/, { label: "MI", className: "mistral" }],
    [/together/, { label: "TG", className: "together" }],
    [/\bxai\b|grok/, { label: "XA", className: "xai" }],
    [/zai|glm/, { label: "Z", className: "zai" }],
    [/moonshot|kimi/, { label: "KM", className: "kimi" }],
    [/byteplus/, { label: "BP", className: "byteplus" }],
    [/volcengine/, { label: "VE", className: "volcengine" }],
    [/chutes/, { label: "CH", className: "chutes" }],
    [/custom|manual/, { label: "CU", className: "custom" }],
  ];
  return entries.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function optionKindForStep(step: ControlWizardStep): WizardOptionKind {
  const text = `${step.title ?? ""} ${step.message ?? ""}`.toLowerCase();
  if (text.includes("model/auth provider") || text.includes("auth provider")) {
    return "provider";
  }
  if (text.includes("model")) {
    return "model";
  }
  return "default";
}

function renderOptionButton(params: {
  option: ControlWizardStepOption;
  active: boolean;
  disabled?: boolean;
  kind: WizardOptionKind;
  onClick: () => void;
}) {
  const logo =
    params.kind === "provider" || params.kind === "model"
      ? providerLogoForOption(params.option)
      : null;
  return html`
    <button
      class="control-panel-option ${params.active
        ? "active"
        : ""} control-panel-option--${params.kind}"
      ?disabled=${params.disabled === true}
      @click=${params.onClick}
    >
      ${logo
        ? html`<span
            class="control-panel-provider-logo control-panel-provider-logo--${logo.className}"
            >${logo.label}</span
          >`
        : nothing}
      <span class="control-panel-option__content">
        <strong>${params.option.label}</strong>
        ${params.option.hint ? html`<small>${params.option.hint}</small>` : nothing}
      </span>
      ${params.active
        ? html`<span class="control-panel-option__selected">Selected</span>`
        : nothing}
    </button>
  `;
}

function renderTextStep(props: ControlPanelProps, step: ControlWizardStep) {
  const value = typeof props.wizardAnswerValue === "string" ? props.wizardAnswerValue : "";
  const hint = textStepHint(step, value);
  return html`
    <form
      class="control-panel-wizard-form"
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        props.onWizardSubmit(value);
      }}
    >
      <input
        class="input"
        type=${step.sensitive ? "password" : "text"}
        autocomplete=${step.sensitive ? "new-password" : "off"}
        placeholder=${step.placeholder ?? ""}
        .value=${value}
        @input=${(event: InputEvent) =>
          props.onWizardAnswerChange((event.currentTarget as HTMLInputElement).value)}
      />
      ${hint ? html`<div class="control-panel-field-hint">${hint}</div>` : nothing}
      <div class="control-panel-actions">
        <button class="btn btn--primary" ?disabled=${props.wizardLoading}>
          ${props.wizardLoading ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  `;
}

function textStepHint(step: ControlWizardStep, value: string): string | null {
  const text = `${step.title ?? ""} ${step.message ?? ""} ${step.placeholder ?? ""}`.toLowerCase();
  if (step.sensitive) {
    if (!value.trim()) {
      return text.includes("api key")
        ? "Enter a new key, or choose the existing-key option if one was offered."
        : "Secret input is not persisted in the browser.";
    }
    return "This value is sent to the gateway and stored in the configured credential store.";
  }
  if (!value.trim() && text.includes("required")) {
    return "This field is required before saving.";
  }
  return null;
}

function renderSelectStep(props: ControlPanelProps, step: ControlWizardStep) {
  const options = step.options ?? [];
  const selected = props.wizardAnswerValue ?? step.initialValue ?? null;
  const kind = optionKindForStep(step);
  return html`
    <div class="control-panel-option-grid ${kind === "provider" ? "is-provider-list" : ""}">
      ${options.map((option) =>
        renderOptionButton({
          option,
          active: valuesEqual(selected, option.value),
          disabled: props.wizardLoading,
          kind,
          onClick: () => {
            props.onWizardAnswerChange(option.value);
            props.onWizardSubmit(option.value);
          },
        }),
      )}
    </div>
  `;
}

function renderMultiselectStep(props: ControlPanelProps, step: ControlWizardStep) {
  const selected = Array.isArray(props.wizardAnswerValue) ? props.wizardAnswerValue : [];
  const toggle = (option: ControlWizardStepOption) => {
    const next = selected.some((value) => valuesEqual(value, option.value))
      ? selected.filter((value) => !valuesEqual(value, option.value))
      : [...selected, option.value];
    props.onWizardAnswerChange(next);
  };
  return html`
    <div class="control-panel-option-grid">
      ${(step.options ?? []).map((option) =>
        renderOptionButton({
          option,
          active: selected.some((value) => valuesEqual(value, option.value)),
          disabled: props.wizardLoading,
          kind: optionKindForStep(step),
          onClick: () => toggle(option),
        }),
      )}
    </div>
    <div class="control-panel-next-bar">
      <span>${selected.length} selected</span>
      <button
        class="btn btn--primary"
        ?disabled=${props.wizardLoading}
        @click=${() => props.onWizardSubmit(selected)}
      >
        Apply selected
      </button>
    </div>
  `;
}

function renderConfirmStep(props: ControlPanelProps) {
  return html`
    <div class="control-panel-actions">
      <button
        class="btn btn--primary"
        ?disabled=${props.wizardLoading}
        @click=${() => props.onWizardSubmit(true)}
      >
        Yes
      </button>
      <button
        class="btn"
        ?disabled=${props.wizardLoading}
        @click=${() => props.onWizardSubmit(false)}
      >
        No
      </button>
    </div>
  `;
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) {
    return "0s";
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function lastProgressLine(step: ControlWizardStep): string {
  const text = step.message ?? step.title ?? "Working...";
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? "Working...";
}

function renderProgressStep(step: ControlWizardStep, startedAt?: number | null) {
  return html`
    <div class="control-panel-progress" role="status" aria-live="polite">
      <div class="control-panel-progress__bar">
        <span></span>
      </div>
      <div class="control-panel-progress__label">${step.title ?? "Working..."}</div>
      <div class="control-panel-progress__meta">
        <span>Elapsed ${formatElapsed(startedAt ?? null)}</span>
        <span>Last update: ${lastProgressLine(step)}</span>
      </div>
    </div>
  `;
}

function renderActionStep(props: ControlPanelProps, step: ControlWizardStep) {
  return html`
    <div class="control-panel-action-step">
      ${step.imageDataUrl
        ? html`
            <div class="control-panel-qr">
              <img src=${step.imageDataUrl} alt="Setup QR code" />
            </div>
          `
        : nothing}
      <div class="control-panel-actions">
        <button
          class="btn btn--primary"
          ?disabled=${props.wizardLoading}
          @click=${() => props.onWizardSubmit("primary")}
        >
          ${step.primaryLabel ?? "Continue"}
        </button>
        ${step.secondaryLabel
          ? html`
              <button
                class="btn"
                ?disabled=${props.wizardLoading}
                @click=${() => props.onWizardSubmit("secondary")}
              >
                ${step.secondaryLabel}
              </button>
            `
          : nothing}
        ${step.dangerLabel
          ? html`
              <button
                class="btn danger"
                ?disabled=${props.wizardLoading}
                @click=${() => props.onWizardSubmit("cancel")}
              >
                ${step.dangerLabel}
              </button>
            `
          : nothing}
      </div>
    </div>
  `;
}

function renderWizardEscapeActions(props: ControlPanelProps) {
  if (!props.wizardSessionId) {
    return nothing;
  }
  return html`
    <div class="control-panel-wizard-step__footer">
      <button class="btn danger" ?disabled=${props.wizardLoading} @click=${props.onWizardCancel}>
        Cancel setup
      </button>
    </div>
  `;
}

function renderCurrentWizardStep(props: ControlPanelProps) {
  const step = props.wizardStep;
  if (!step) {
    if (props.wizardLoading) {
      return html`
        <div class="control-panel-wizard-step">
          ${renderProgressStep(
            {
              id: "starting",
              type: "progress",
              title: "Working",
              message:
                "Kova is preparing the next setup step. Long plugin installs can take a few minutes.",
            },
            props.wizardStepStartedAt,
          )}
        </div>
      `;
    }
    if (props.wizardStatus === "done") {
      const requiresRestart = setupSummaryRequiresRestart(props.wizardCompletedSteps);
      return html`
        <div class="control-panel-wizard-empty is-done control-panel-summary">
          <strong>Setup complete</strong>
          <span>The gateway accepted the setup flow.</span>
          ${renderCompletedWizardSteps(props.wizardCompletedSteps)}
          <div class="control-panel-summary__status ${requiresRestart ? "is-warn" : "is-ok"}">
            ${requiresRestart
              ? "Restart may be required because this setup touched gateway, auth, or service settings."
              : "No restart-sensitive setup changes were detected in this browser flow."}
          </div>
        </div>
      `;
    }
    return html`
      <div class="control-panel-wizard-empty">
        <strong>Start the guided setup</strong>
        <span>
          This runs the same onboarding path as <code>kova onboard</code>: provider auth, workspace,
          gateway, channels, web search, daemon, skills, and health checks.
        </span>
      </div>
    `;
  }

  return html`
    ${renderCompletedWizardSteps(props.wizardCompletedSteps)}
    <div class="control-panel-wizard-step">
      <div class="control-panel-wizard-step__meta">
        <span>Current step</span>
        <span>${step.type}</span>
        ${step.sensitive ? html`<span>secret input</span>` : nothing}
      </div>
      ${props.wizardLoading && step.type !== "progress"
        ? html`
            <div class="control-panel-inline-progress" role="status" aria-live="polite">
              <span></span>
              Applying this step. Keep this page open.
            </div>
          `
        : nothing}
      ${step.title ? html`<h3>${step.title}</h3>` : nothing}
      ${step.message ? html`<p>${step.message}</p>` : nothing}
      ${step.type === "text"
        ? renderTextStep(props, step)
        : step.type === "select"
          ? renderSelectStep(props, step)
          : step.type === "multiselect"
            ? renderMultiselectStep(props, step)
            : step.type === "confirm"
              ? renderConfirmStep(props)
              : step.type === "progress"
                ? renderProgressStep(step, props.wizardStepStartedAt)
                : step.type === "action"
                  ? renderActionStep(props, step)
                  : html`
                      <div class="control-panel-actions">
                        <button
                          class="btn btn--primary"
                          ?disabled=${props.wizardLoading}
                          @click=${() => props.onWizardSubmit(null)}
                        >
                          Continue
                        </button>
                      </div>
                    `}
      ${renderWizardEscapeActions(props)}
    </div>
  `;
}

function renderWizardSection(props: ControlPanelProps) {
  const showStartActions = !props.wizardSessionId && props.wizardStatus !== "done";
  return html`
    <section class="control-panel-section" id="control-panel-guided-setup">
      ${renderSectionHeader({
        icon: icons.spark,
        title: "Setup",
        detail: "Run the real Kova onboarding and settings flow from the browser.",
      })}
      <div class="control-panel-section__body">
        ${showStartActions
          ? html`
              <div class="control-panel-wizard-toolbar">
                <button
                  class="btn btn--primary"
                  ?disabled=${!props.connected || props.wizardLoading}
                  @click=${() => props.onWizardStart("local")}
                >
                  ${props.wizardLoading ? "Starting..." : "Start local setup"}
                </button>
                <button
                  class="btn"
                  ?disabled=${!props.connected || props.wizardLoading}
                  @click=${() => props.onWizardStart("remote")}
                >
                  Start remote setup
                </button>
              </div>
            `
          : nothing}
        ${props.wizardSessionId
          ? html`
              <div class="control-panel-wizard-toolbar">
                <button
                  class="btn"
                  ?disabled=${props.wizardLoading}
                  @click=${props.onWizardRefresh}
                >
                  Refresh step
                </button>
              </div>
            `
          : nothing}
        ${props.wizardError
          ? html`<div class="callout danger">${props.wizardError}</div>`
          : nothing}
        ${!props.connected
          ? html`<div class="callout warn">Connect to the gateway before running setup.</div>`
          : nothing}
        ${renderCurrentWizardStep(props)}
      </div>
    </section>
  `;
}

function renderInfoSection(props: ControlPanelProps) {
  return html`
    <section class="control-panel-section">
      ${renderSectionHeader({
        icon: icons.radio,
        title: "Current target",
        detail: "The setup wizard writes through the gateway, not browser local storage.",
      })}
      <div class="control-panel-section__body">
        <div class="control-panel-meta-row">
          <span class="control-panel-meta-row__label">Assistant</span>
          <span class="control-panel-meta-row__value">${props.assistantName || "Kova"}</span>
        </div>
        <div class="control-panel-meta-row">
          <span class="control-panel-meta-row__label">Gateway</span>
          <span class="control-panel-meta-row__value"><code>${props.gatewayUrl}</code></span>
        </div>
        <div class="control-panel-meta-row">
          <span class="control-panel-meta-row__label">Config file</span>
          <span class="control-panel-meta-row__value"
            ><code>${props.configPath ?? "not loaded"}</code></span
          >
        </div>
        <div class="control-panel-meta-row">
          <span class="control-panel-meta-row__label">Version</span>
          <span class="control-panel-meta-row__value">${props.version || "unknown"}</span>
        </div>
      </div>
    </section>
  `;
}

export function renderControlPanel(props: ControlPanelProps) {
  return html`
    <div class="view control-panel">
      ${renderSetupTimeline(props)}
      <main class="control-panel-main">
        <section class="control-panel-hero">
          <div>
            <span class="control-panel-eyebrow">Project onboarding</span>
            <h1>Control Panel</h1>
            <p>
              Configure Kova from the browser using the same setup flow that powers
              <code>kova onboard</code> and <code>kova settings</code>.
            </p>
          </div>
          ${renderGatewayStatus(props)}
        </section>
        ${renderWizardSection(props)} ${renderInfoSection(props)}
      </main>
    </div>
  `;
}
