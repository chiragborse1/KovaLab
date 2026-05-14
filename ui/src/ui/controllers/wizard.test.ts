import { describe, expect, it, vi } from "vitest";
import {
  cancelControlWizard,
  startControlWizard,
  submitControlWizardStep,
  type ControlWizardState,
} from "./wizard.ts";

function createState(request: ReturnType<typeof vi.fn>): ControlWizardState {
  return {
    client: { request } as never,
    connected: true,
    controlWizardAnswerValue: "ok",
    controlWizardError: null,
    controlWizardLoading: false,
    controlWizardSessionId: "wiz_1",
    controlWizardStatus: "running",
    controlWizardStep: { id: "step_1", type: "text", message: "Token" },
    controlWizardCompletedSteps: [],
    controlWizardActiveSection: null,
    controlWizardStepStartedAt: null,
  };
}

describe("control wizard controller", () => {
  it("starts focused configure sections through wizard.start", async () => {
    const request = vi.fn(async () => ({ sessionId: "wiz_2", done: true, status: "done" }));
    const state = createState(request);
    state.controlWizardSessionId = null;
    state.controlWizardStep = null;

    await startControlWizard(state, { flow: "configure", section: "channels" });

    expect(request).toHaveBeenCalledWith("wizard.start", {
      flow: "configure",
      section: "channels",
    });
    expect(state.controlWizardStatus).toBe("done");
    expect(state.controlWizardActiveSection).toBe("channels");
  });

  it("auto-advances passive note steps after starting a focused section", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        sessionId: "wiz_2",
        done: false,
        status: "running",
        step: { id: "intro", type: "note", title: "Kova configure" },
      })
      .mockResolvedValueOnce({
        done: false,
        status: "running",
        step: {
          id: "provider",
          type: "select",
          message: "Model/auth provider",
          options: [{ label: "OpenRouter", value: "openrouter" }],
        },
      });
    const state = createState(request);
    state.controlWizardSessionId = null;
    state.controlWizardStep = null;

    await startControlWizard(state, { flow: "configure", section: "model" });

    expect(request).toHaveBeenNthCalledWith(2, "wizard.next", {
      sessionId: "wiz_2",
      answer: { stepId: "intro", value: null },
    });
    expect(state.controlWizardStep?.id).toBe("provider");
    expect(state.controlWizardActiveSection).toBe("model");
    expect(state.controlWizardStepStartedAt).toEqual(expect.any(Number));
  });

  it("records completed interactive steps before showing the next prompt", async () => {
    const request = vi.fn(async () => ({
      done: false,
      status: "running",
      step: { id: "api-key", type: "text", message: "Enter API key" },
    }));
    const state = createState(request);
    state.controlWizardStep = {
      id: "provider",
      type: "select",
      message: "Model/auth provider",
      options: [{ label: "OpenRouter", value: "openrouter" }],
    };

    await submitControlWizardStep(state, "openrouter");

    expect(state.controlWizardCompletedSteps).toHaveLength(1);
    expect(state.controlWizardCompletedSteps[0]).toMatchObject({
      step: { id: "provider" },
      value: "openrouter",
    });
    expect(state.controlWizardStep?.id).toBe("api-key");
    expect(state.controlWizardStepStartedAt).toEqual(expect.any(Number));
  });

  it("clears stale sessions when the gateway reports wizard not found", async () => {
    const request = vi.fn(async () => {
      throw new Error("wizard not found");
    });
    const state = createState(request);
    state.controlWizardActiveSection = "model";
    state.controlWizardCompletedSteps = [
      {
        step: { id: "provider", type: "select", message: "Model/auth provider" },
        value: "openrouter",
      },
    ];

    await submitControlWizardStep(state);

    expect(state.controlWizardSessionId).toBeNull();
    expect(state.controlWizardStep).toBeNull();
    expect(state.controlWizardStatus).toBe("error");
    expect(state.controlWizardError).toContain("gateway restart");
    expect(state.controlWizardActiveSection).toBe("model");
    expect(state.controlWizardCompletedSteps).toHaveLength(1);
    expect(state.controlWizardStepStartedAt).toBeNull();
  });

  it("also clears stale sessions during cancel", async () => {
    const request = vi.fn(async () => {
      throw new Error("wizard not found");
    });
    const state = createState(request);
    state.controlWizardActiveSection = "channels";
    state.controlWizardCompletedSteps = [
      {
        step: { id: "channel", type: "select", message: "Channel" },
        value: "telegram",
      },
    ];

    await cancelControlWizard(state);

    expect(state.controlWizardSessionId).toBeNull();
    expect(state.controlWizardStep).toBeNull();
    expect(state.controlWizardStatus).toBe("error");
    expect(state.controlWizardActiveSection).toBe("channels");
    expect(state.controlWizardCompletedSteps).toHaveLength(1);
    expect(state.controlWizardStepStartedAt).toBeNull();
  });
});
