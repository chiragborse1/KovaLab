import type { GatewayBrowserClient } from "../gateway.ts";

export type ControlWizardStatus = "running" | "done" | "cancelled" | "error";
export type ControlWizardSection =
  | "workspace"
  | "model"
  | "web"
  | "gateway"
  | "daemon"
  | "channels"
  | "plugins"
  | "skills"
  | "health";
export type ControlWizardStepType =
  | "note"
  | "select"
  | "text"
  | "confirm"
  | "multiselect"
  | "progress"
  | "action";

export type ControlWizardStepOption = {
  value: unknown;
  label: string;
  hint?: string;
};

export type ControlWizardStep = {
  id: string;
  type: ControlWizardStepType;
  title?: string;
  message?: string;
  options?: ControlWizardStepOption[];
  initialValue?: unknown;
  placeholder?: string;
  sensitive?: boolean;
  imageDataUrl?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  dangerLabel?: string;
  executor?: "gateway" | "client";
};

type WizardResult = {
  done: boolean;
  step?: ControlWizardStep;
  status?: ControlWizardStatus;
  error?: string;
};

type WizardStartResult = WizardResult & {
  sessionId: string;
};

export type ControlWizardState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  controlWizardLoading: boolean;
  controlWizardSessionId: string | null;
  controlWizardStep: ControlWizardStep | null;
  controlWizardStatus: ControlWizardStatus | null;
  controlWizardError: string | null;
  controlWizardAnswerValue: unknown;
};

function initialAnswerForStep(step: ControlWizardStep | null): unknown {
  if (!step) {
    return null;
  }
  if (step.type === "multiselect") {
    return Array.isArray(step.initialValue) ? step.initialValue : [];
  }
  if (step.type === "confirm") {
    return typeof step.initialValue === "boolean" ? step.initialValue : true;
  }
  if (step.type === "text") {
    return typeof step.initialValue === "string" ? step.initialValue : "";
  }
  return step.initialValue ?? null;
}

function applyWizardResult(
  state: ControlWizardState,
  result: WizardResult & { sessionId?: string },
) {
  if (result.sessionId) {
    state.controlWizardSessionId = result.sessionId;
  }
  state.controlWizardStatus = result.status ?? null;
  state.controlWizardError = result.error ?? null;
  state.controlWizardStep = result.done ? null : (result.step ?? null);
  state.controlWizardAnswerValue = initialAnswerForStep(state.controlWizardStep);
  if (result.done) {
    state.controlWizardSessionId = null;
  }
}

function isWizardNotFoundError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /wizard not found/i.test(message);
}

function resetMissingWizardSession(state: ControlWizardState) {
  state.controlWizardSessionId = null;
  state.controlWizardStep = null;
  state.controlWizardStatus = "error";
  state.controlWizardAnswerValue = null;
  state.controlWizardError =
    "Setup session was interrupted by a gateway restart. Start the setup again; saved changes were already written to config.";
}

export async function startControlWizard(
  state: ControlWizardState,
  params:
    | { flow?: "onboard"; mode?: "local" | "remote"; workspace?: string }
    | { flow: "configure"; section: ControlWizardSection } = {},
) {
  if (!state.client || !state.connected || state.controlWizardLoading) {
    return;
  }
  state.controlWizardLoading = true;
  state.controlWizardError = null;
  try {
    const result = await state.client.request<WizardStartResult>("wizard.start", params);
    applyWizardResult(state, result);
  } catch (err) {
    if (isWizardNotFoundError(err)) {
      resetMissingWizardSession(state);
    } else {
      state.controlWizardError = err instanceof Error ? err.message : String(err);
    }
  } finally {
    state.controlWizardLoading = false;
  }
}

export async function submitControlWizardStep(state: ControlWizardState, value?: unknown) {
  if (!state.client || !state.connected || state.controlWizardLoading) {
    return;
  }
  const sessionId = state.controlWizardSessionId;
  const step = state.controlWizardStep;
  if (!sessionId || !step) {
    return;
  }
  state.controlWizardLoading = true;
  state.controlWizardError = null;
  try {
    const answerValue = arguments.length >= 2 ? value : state.controlWizardAnswerValue;
    const result = await state.client.request<WizardResult>("wizard.next", {
      sessionId,
      answer: { stepId: step.id, value: answerValue },
    });
    applyWizardResult(state, result);
  } catch (err) {
    if (isWizardNotFoundError(err)) {
      resetMissingWizardSession(state);
    } else {
      state.controlWizardError = err instanceof Error ? err.message : String(err);
    }
  } finally {
    state.controlWizardLoading = false;
  }
}

export async function refreshControlWizard(state: ControlWizardState) {
  if (
    !state.client ||
    !state.connected ||
    state.controlWizardLoading ||
    !state.controlWizardSessionId
  ) {
    return;
  }
  state.controlWizardLoading = true;
  state.controlWizardError = null;
  try {
    const result = await state.client.request<WizardResult>("wizard.next", {
      sessionId: state.controlWizardSessionId,
    });
    applyWizardResult(state, result);
  } catch (err) {
    if (isWizardNotFoundError(err)) {
      resetMissingWizardSession(state);
    } else {
      state.controlWizardError = err instanceof Error ? err.message : String(err);
    }
  } finally {
    state.controlWizardLoading = false;
  }
}

export async function cancelControlWizard(state: ControlWizardState) {
  if (
    !state.client ||
    !state.connected ||
    state.controlWizardLoading ||
    !state.controlWizardSessionId
  ) {
    state.controlWizardSessionId = null;
    state.controlWizardStep = null;
    state.controlWizardStatus = "cancelled";
    return;
  }
  state.controlWizardLoading = true;
  state.controlWizardError = null;
  try {
    const result = await state.client.request<{ status: ControlWizardStatus; error?: string }>(
      "wizard.cancel",
      { sessionId: state.controlWizardSessionId },
    );
    state.controlWizardStatus = result.status;
    state.controlWizardError = result.error ?? null;
    state.controlWizardSessionId = null;
    state.controlWizardStep = null;
    state.controlWizardAnswerValue = null;
  } catch (err) {
    if (isWizardNotFoundError(err)) {
      resetMissingWizardSession(state);
    } else {
      state.controlWizardError = err instanceof Error ? err.message : String(err);
    }
  } finally {
    state.controlWizardLoading = false;
  }
}
