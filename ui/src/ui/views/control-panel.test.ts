/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderControlPanel, type ControlPanelProps } from "./control-panel.ts";

function createProps(overrides: Partial<ControlPanelProps> = {}): ControlPanelProps {
  return {
    connected: true,
    gatewayUrl: "ws://127.0.0.1:18789",
    assistantName: "Kova",
    version: "2.0.0-beta.5",
    configPath: "/home/user/.kova/kova.json",
    config: {},
    wizardLoading: false,
    wizardSessionId: null,
    wizardStep: null,
    wizardStatus: null,
    wizardError: null,
    wizardAnswerValue: null,
    wizardCompletedSteps: [],
    wizardActiveSection: null,
    wizardStepStartedAt: null,
    modelCatalog: [],
    modelAuthStatus: null,
    modelAuthStatusLoading: false,
    modelAuthStatusError: null,
    pluginsStatus: null,
    pluginsStatusLoading: false,
    pluginsStatusError: null,
    modelsLoading: false,
    currentModel: null,
    modelSaving: false,
    modelError: null,
    modelSearch: "",
    manualModel: "",
    onWizardStart: vi.fn(),
    onWizardStartSection: vi.fn(),
    onWizardAnswerChange: vi.fn(),
    onWizardSubmit: vi.fn(),
    onWizardCancel: vi.fn(),
    onWizardRefresh: vi.fn(),
    onRefreshModelAuth: vi.fn(),
    onRefreshPlugins: vi.fn(),
    onModelSelect: vi.fn(),
    onModelSearchChange: vi.fn(),
    onManualModelChange: vi.fn(),
    onManualModelSubmit: vi.fn(),
    ...overrides,
  };
}

describe("renderControlPanel", () => {
  it("renders onboarding setup sections and starts the local wizard", () => {
    const onWizardStart = vi.fn();
    const container = document.createElement("div");

    render(renderControlPanel(createProps({ onWizardStart })), container);

    expect(container.textContent).toContain("Control Panel");
    expect(container.textContent).toContain("Model provider");
    expect(container.textContent).toContain("Channels");
    expect(container.textContent).toContain("Start local setup");

    const start = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start local setup"),
    ) as HTMLButtonElement | undefined;
    start?.click();

    expect(onWizardStart).toHaveBeenCalledWith("local");
  });

  it("starts a focused configure section from the setup timeline", () => {
    const onWizardStartSection = vi.fn();
    const container = document.createElement("div");

    render(renderControlPanel(createProps({ onWizardStartSection })), container);

    const modelStep = Array.from(container.querySelectorAll(".control-panel-step")).find((button) =>
      button.textContent?.includes("Model provider"),
    ) as HTMLButtonElement | undefined;
    modelStep?.click();

    expect(onWizardStartSection).toHaveBeenCalledWith("model");
  });

  it("marks the active setup section in the side menu", () => {
    const container = document.createElement("div");

    render(renderControlPanel(createProps({ wizardActiveSection: "model" })), container);

    const modelStep = Array.from(container.querySelectorAll(".control-panel-step")).find((button) =>
      button.textContent?.includes("Model provider"),
    ) as HTMLButtonElement | undefined;

    expect(modelStep?.classList.contains("is-active")).toBe(true);
  });

  it("locks setup timeline steps while another wizard step is open", () => {
    const onWizardStartSection = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: { id: "step_1", type: "note", message: "Current step" },
          onWizardStartSection,
        }),
      ),
      container,
    );

    const channelsStep = Array.from(container.querySelectorAll(".control-panel-step")).find(
      (button) => button.textContent?.includes("Channels"),
    ) as HTMLButtonElement | undefined;
    expect(channelsStep?.disabled).toBe(true);
    channelsStep?.click();

    expect(onWizardStartSection).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Browser setup saves config");
  });

  it("renders sidebar setup items without summary copy", () => {
    const container = document.createElement("div");

    render(renderControlPanel(createProps()), container);

    expect(container.querySelector(".control-panel-step small")).toBeNull();
    expect(container.textContent).not.toContain("Detect current workspace");
  });

  it("renders provider choices from the live wizard step", () => {
    const onWizardSubmit = vi.fn();
    const onWizardAnswerChange = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: {
            id: "step_1",
            type: "select",
            message: "Model/auth provider",
            options: [
              { label: "OpenAI Codex", value: "openai-codex" },
              { label: "OpenRouter", value: "openrouter" },
            ],
          },
          onWizardAnswerChange,
          onWizardSubmit,
        }),
      ),
      container,
    );

    const currentStep = container.querySelector(
      ".control-panel-flow-card.is-current",
    ) as HTMLElement | null;
    const openRouter = Array.from(
      currentStep?.querySelectorAll(".control-panel-option") ?? [],
    ).find((button) => button.textContent?.includes("OpenRouter")) as HTMLButtonElement | undefined;
    openRouter?.click();

    expect(container.querySelector(".control-panel-provider-logo")).not.toBeNull();
    expect(onWizardAnswerChange).toHaveBeenCalledWith("openrouter");
    expect(onWizardSubmit).toHaveBeenCalledWith("openrouter");
  });

  it("does not render a continue bar for single-choice wizard options", () => {
    const onWizardSubmit = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: {
            id: "step_1",
            type: "select",
            message: "Default model",
            options: [
              { label: "Keep current (openrouter/auto)", value: "__keep__" },
              { label: "OpenRouter Auto", value: "openrouter/auto" },
            ],
          },
          wizardAnswerValue: "openrouter/auto",
          onWizardSubmit,
        }),
      ),
      container,
    );

    expect(container.querySelector(".control-panel-next-bar")).toBeNull();

    const openRouterAuto = Array.from(container.querySelectorAll(".control-panel-option")).find(
      (button) => button.textContent?.includes("OpenRouter Auto"),
    ) as HTMLButtonElement | undefined;
    openRouterAuto?.click();
    expect(onWizardSubmit).toHaveBeenCalledWith("openrouter/auto");
  });

  it("routes sensitive text input to the wizard answer", () => {
    const onWizardAnswerChange = vi.fn();
    const onWizardSubmit = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: {
            id: "step_2",
            type: "text",
            message: "Enter OpenRouter API key",
            sensitive: true,
          },
          wizardAnswerValue: "sk-test",
          onWizardAnswerChange,
          onWizardSubmit,
        }),
      ),
      container,
    );

    const input = container.querySelector("input") as HTMLInputElement | null;
    expect(input?.type).toBe("password");
    input!.value = "sk-next";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(onWizardAnswerChange).toHaveBeenCalledWith("sk-next");

    const form = container.querySelector("form") as HTMLFormElement | null;
    form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    expect(onWizardSubmit).toHaveBeenCalledWith("sk-test");
    expect(container.textContent).toContain("stored in the configured credential store");
  });

  it("shows a helper hint for empty API key prompts", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: {
            id: "step_2",
            type: "text",
            message: "Enter OpenRouter API key",
            sensitive: true,
          },
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Enter a new key");
  });

  it("renders progress steps as a loading bar without a continue button", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: {
            id: "step_progress",
            type: "progress",
            title: "Installing WhatsApp plugin...",
            message: "Resolving package...\nDownloading @kovaai/whatsapp@beta...",
          },
          wizardStepStartedAt: Date.now() - 65_000,
        }),
      ),
      container,
    );

    expect(container.querySelector(".control-panel-progress")).not.toBeNull();
    expect(container.textContent).toContain("Downloading @kovaai/whatsapp@beta");
    expect(container.textContent).toContain("Elapsed 1m");
    expect(container.textContent).toContain("Last update: Downloading @kovaai/whatsapp@beta");
    expect(container.textContent).not.toContain("Continue");
  });

  it("renders QR action steps with back and cancel controls", () => {
    const onWizardSubmit = vi.fn();
    const onWizardCancel = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardStep: {
            id: "step_qr",
            type: "action",
            title: "WhatsApp linking",
            message: "Scan this QR in WhatsApp.",
            imageDataUrl: "data:image/png;base64,qr",
            primaryLabel: "Check scan",
            secondaryLabel: "Refresh QR",
            dangerLabel: "Skip linking",
          },
          onWizardSubmit,
          onWizardCancel,
        }),
      ),
      container,
    );

    expect(container.querySelector(".control-panel-qr img")?.getAttribute("src")).toBe(
      "data:image/png;base64,qr",
    );

    const checkScan = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Check scan"),
    ) as HTMLButtonElement | undefined;
    checkScan?.click();
    expect(onWizardSubmit).toHaveBeenCalledWith("primary");

    expect(container.textContent).not.toContain("Back to setup steps");
    const cancel = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Cancel setup"),
    ) as HTMLButtonElement | undefined;
    cancel?.click();
    expect(onWizardCancel).toHaveBeenCalled();
  });

  it("keeps completed wizard answers above the current step", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardCompletedSteps: [
            {
              step: {
                id: "provider",
                type: "select",
                message: "Model/auth provider",
                options: [{ label: "OpenRouter", value: "openrouter" }],
              },
              value: "openrouter",
            },
          ],
          wizardStep: {
            id: "use-existing",
            type: "confirm",
            message: "Use existing OPENROUTER_API_KEY?",
          },
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Model/auth provider");
    expect(container.textContent).toContain("OpenRouter");
    expect(container.textContent).toContain("Use existing OPENROUTER_API_KEY?");
  });

  it("renders setup sections as one appended page instead of replacing previous choices", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardActiveSection: "model",
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          currentModel: "openrouter/auto",
          modelCatalog: [
            { id: "openrouter/auto", name: "OpenRouter Auto", provider: "openrouter" },
            { id: "gpt-5.5", name: "GPT-5.5", provider: "openai" },
          ],
          wizardCompletedSteps: [
            {
              step: {
                id: "provider",
                type: "select",
                message: "Model/auth provider",
                options: [
                  { label: "OpenAI Codex", value: "openai-codex" },
                  { label: "OpenRouter", value: "openrouter" },
                ],
              },
              value: "openrouter",
            },
          ],
          wizardStep: {
            id: "api-key",
            type: "text",
            message: "Enter OpenRouter API key",
            sensitive: true,
          },
        }),
      ),
      container,
    );

    expect(container.querySelector(".control-panel-model-flow")).not.toBeNull();
    expect(container.querySelector(".control-panel-completed-flow")).toBeNull();
    expect(container.textContent).toContain("Model provider setup");
    expect(container.textContent).toContain("Default model picker");
    expect(container.textContent).toContain("OpenRouter Auto");
    expect(container.textContent).toContain("OpenAI Codex");
    expect(container.textContent).toContain("OpenRouter");
    expect(container.textContent).toContain("Enter OpenRouter API key");

    const completedProviderCard = container.querySelector(
      ".control-panel-flow-card.is-complete",
    ) as HTMLElement | null;
    const openRouter = Array.from(
      completedProviderCard?.querySelectorAll(".control-panel-option") ?? [],
    ).find((button) => button.textContent?.includes("OpenRouter")) as HTMLButtonElement | undefined;
    expect(openRouter?.classList.contains("active")).toBe(true);
    expect(openRouter?.disabled).toBe(true);
  });

  it("saves selected catalog models from the model picker", () => {
    const onModelSelect = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardActiveSection: "model",
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          currentModel: "openrouter/auto",
          modelCatalog: [
            { id: "openrouter/auto", name: "OpenRouter Auto", provider: "openrouter" },
            { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "openrouter" },
          ],
          wizardStep: {
            id: "provider",
            type: "select",
            message: "Model/auth provider",
            options: [{ label: "OpenRouter", value: "openrouter" }],
          },
          onModelSelect,
        }),
      ),
      container,
    );

    const deepseek = Array.from(
      container.querySelectorAll(".control-panel-model-picker button"),
    ).find((button) => button.textContent?.includes("DeepSeek Chat")) as
      | HTMLButtonElement
      | undefined;
    deepseek?.click();

    expect(onModelSelect).toHaveBeenCalledWith("openrouter/deepseek/deepseek-chat");
  });

  it("does not filter the model picker by the current default before a provider is selected", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardActiveSection: "model",
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          currentModel: "openrouter/auto",
          modelCatalog: [
            { id: "openrouter/auto", name: "OpenRouter Auto", provider: "openrouter" },
            { id: "gpt-5.5", name: "GPT-5.5", provider: "openai-codex" },
          ],
          wizardStep: {
            id: "provider",
            type: "select",
            message: "Model/auth provider",
            options: [
              { label: "OpenRouter", value: "openrouter" },
              { label: "OpenAI Codex", value: "openai-codex" },
            ],
          },
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("OpenRouter Auto");
    expect(container.textContent).toContain("GPT-5.5");
    expect(container.textContent).toContain("Current default");
  });

  it("filters catalog models and submits manual model IDs", () => {
    const onModelSearchChange = vi.fn();
    const onManualModelChange = vi.fn();
    const onManualModelSubmit = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardActiveSection: "model",
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          currentModel: "openrouter/auto",
          modelSearch: "deepseek",
          manualModel: "openrouter/custom-model",
          modelCatalog: [
            { id: "openrouter/auto", name: "OpenRouter Auto", provider: "openrouter" },
            { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", provider: "openrouter" },
          ],
          wizardStep: {
            id: "provider",
            type: "select",
            message: "Model/auth provider",
            options: [{ label: "OpenRouter", value: "openrouter" }],
          },
          onModelSearchChange,
          onManualModelChange,
          onManualModelSubmit,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("DeepSeek Chat");
    expect(container.textContent).not.toContain("OpenRouter Auto");

    const search = container.querySelector('input[type="search"]') as HTMLInputElement | null;
    search!.value = "auto";
    search!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(onModelSearchChange).toHaveBeenCalledWith("auto");

    const manual = Array.from(container.querySelectorAll("input")).find(
      (input) => input.placeholder === "provider/model",
    ) as HTMLInputElement | undefined;
    manual!.value = "openrouter/manual-next";
    manual!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(onManualModelChange).toHaveBeenCalledWith("openrouter/manual-next");

    const form = manual?.closest("form") as HTMLFormElement | null;
    form?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    expect(onManualModelSubmit).toHaveBeenCalled();
  });

  it("shows model save and error states", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardActiveSection: "model",
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          currentModel: "openrouter/auto",
          modelSaving: true,
          modelError: "Config write failed",
          wizardStep: {
            id: "provider",
            type: "select",
            message: "Model/auth provider",
            options: [{ label: "OpenRouter", value: "openrouter" }],
          },
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Saving default model");
    expect(container.textContent).toContain("Config write failed");
    expect(
      Array.from(container.querySelectorAll(".control-panel-model-picker button")).every(
        (button) => (button as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
  });

  it("uses the appended setup flow for non-model sections too", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardActiveSection: "channels",
          wizardSessionId: "wiz_1",
          wizardStatus: "running",
          wizardCompletedSteps: [
            {
              step: {
                id: "channel",
                type: "select",
                message: "Channel to configure",
                options: [{ label: "Telegram", value: "telegram" }],
              },
              value: "telegram",
            },
          ],
          wizardStep: {
            id: "token",
            type: "text",
            message: "Telegram bot token",
            sensitive: true,
          },
        }),
      ),
      container,
    );

    expect(container.querySelector(".control-panel-completed-flow")).toBeNull();
    expect(container.textContent).toContain("Channels setup");
    expect(container.textContent).toContain("Channel to configure");
    expect(container.textContent).toContain("Telegram bot token");
  });

  it("renders a final setup summary and restart guidance", () => {
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          wizardStatus: "done",
          wizardCompletedSteps: [
            {
              step: {
                id: "gateway-auth",
                type: "confirm",
                message: "Enable gateway password auth?",
              },
              value: true,
            },
          ],
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Setup complete");
    expect(container.textContent).toContain("Enable gateway password auth?");
    expect(container.textContent).toContain("Restart may be required");
  });

  it("renders provider auth health and refresh action", () => {
    const onRefreshModelAuth = vi.fn();
    const onWizardStartSection = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          currentModel: "openrouter/auto",
          modelAuthStatus: {
            ts: Date.now(),
            providers: [
              {
                provider: "openrouter",
                displayName: "OpenRouter",
                status: "static",
                profiles: [{ profileId: "openrouter:manual", type: "api_key", status: "static" }],
              },
              {
                provider: "openai-codex",
                displayName: "OpenAI Codex",
                status: "missing",
                profiles: [],
              },
            ],
          },
          onRefreshModelAuth,
          onWizardStartSection,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Provider & auth");
    expect(container.textContent).toContain("Auth attention");
    expect(container.textContent).toContain("OpenRouter");
    expect(container.textContent).toContain("OpenAI Codex");

    const refresh = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Refresh auth"),
    ) as HTMLButtonElement | undefined;
    refresh?.click();
    expect(onRefreshModelAuth).toHaveBeenCalled();

    const configure = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Configure provider"),
    ) as HTMLButtonElement | undefined;
    configure?.click();
    expect(onWizardStartSection).toHaveBeenCalledWith("model");
  });

  it("renders setup diagnostics from the config snapshot", () => {
    const onWizardStartSection = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          config: {
            gateway: { mode: "local", bind: "loopback", port: 18789, auth: { mode: "password" } },
            channels: { telegram: { enabled: true }, whatsapp: { enabled: false } },
            plugins: {
              allow: ["telegram"],
              deny: ["debug-plugin"],
              entries: { telegram: { enabled: true }, browser: { enabled: true } },
              installs: { telegram: { source: "npm" } },
            },
            models: { providers: { openrouter: {} } },
            agents: { list: [{ id: "main" }] },
          },
          onWizardStartSection,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Setup diagnostics");
    expect(container.textContent).toContain("local / loopback");
    expect(container.textContent).toContain("password / 18789");
    expect(container.textContent).toContain("telegram");
    expect(container.textContent).toContain("1 allowlisted · 1 denied");

    const plugins = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Configure plugins"),
    ) as HTMLButtonElement | undefined;
    plugins?.click();
    expect(onWizardStartSection).toHaveBeenCalledWith("plugins");
  });

  it("renders plugin inventory from the gateway status snapshot", () => {
    const onRefreshPlugins = vi.fn();
    const onWizardStartSection = vi.fn();
    const container = document.createElement("div");

    render(
      renderControlPanel(
        createProps({
          pluginsStatus: {
            registrySource: "persisted",
            totals: {
              total: 2,
              enabled: 1,
              disabled: 1,
              errors: 1,
              channels: 1,
              providers: 1,
            },
            plugins: [
              {
                id: "telegram",
                name: "Telegram",
                enabled: true,
                status: "loaded",
                origin: "bundled",
                format: "openclaw",
                version: "2.0.0",
                channelIds: ["telegram"],
                providerIds: [],
                toolNames: [],
                gatewayMethods: [],
                services: [],
                commands: [],
                configSchema: true,
              },
              {
                id: "broken",
                name: "Broken",
                enabled: false,
                status: "error",
                origin: "external",
                format: "openclaw",
                channelIds: [],
                providerIds: ["broken-provider"],
                toolNames: [],
                gatewayMethods: [],
                services: [],
                commands: [],
                configSchema: false,
                error: "failed",
              },
            ],
            diagnostics: [
              {
                level: "error",
                pluginId: "broken",
                message: "manifest failed",
              },
            ],
          },
          onRefreshPlugins,
          onWizardStartSection,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Plugin inventory");
    expect(container.textContent).toContain("persisted");
    expect(container.textContent).toContain("1 / 2");
    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("Broken");
    expect(container.textContent).toContain("broken: manifest failed");

    const refresh = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Refresh plugins"),
    ) as HTMLButtonElement | undefined;
    refresh?.click();
    expect(onRefreshPlugins).toHaveBeenCalled();

    const configure = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Configure plugins"),
    ) as HTMLButtonElement | undefined;
    configure?.click();
    expect(onWizardStartSection).toHaveBeenCalledWith("plugins");
  });
});
