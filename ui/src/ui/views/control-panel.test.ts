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
    wizardLoading: false,
    wizardSessionId: null,
    wizardStep: null,
    wizardStatus: null,
    wizardError: null,
    wizardAnswerValue: null,
    onWizardStart: vi.fn(),
    onWizardStartSection: vi.fn(),
    onWizardAnswerChange: vi.fn(),
    onWizardSubmit: vi.fn(),
    onWizardCancel: vi.fn(),
    onWizardRefresh: vi.fn(),
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

  it("keeps setup timeline steps clickable while another wizard step is open", () => {
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
    expect(channelsStep?.disabled).toBe(false);
    channelsStep?.click();

    expect(onWizardStartSection).toHaveBeenCalledWith("channels");
    expect(container.textContent).not.toContain("Browser setup saves config");
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

    const openRouter = Array.from(container.querySelectorAll(".control-panel-option")).find(
      (button) => button.textContent?.includes("OpenRouter"),
    ) as HTMLButtonElement | undefined;
    openRouter?.click();

    expect(container.querySelector(".control-panel-provider-logo")).not.toBeNull();
    expect(onWizardAnswerChange).toHaveBeenCalledWith("openrouter");
    expect(onWizardSubmit).not.toHaveBeenCalled();
  });

  it("submits the selected wizard option from the visible continue bar", () => {
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

    const continueButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Continue"),
    ) as HTMLButtonElement | undefined;
    continueButton?.click();

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
            message: "Downloading @kovaai/whatsapp@beta...",
          },
        }),
      ),
      container,
    );

    expect(container.querySelector(".control-panel-progress")).not.toBeNull();
    expect(container.textContent).toContain("Downloading @kovaai/whatsapp@beta");
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

    const back = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Back to setup steps"),
    ) as HTMLButtonElement | undefined;
    back?.click();
    expect(onWizardCancel).toHaveBeenCalled();
  });
});
