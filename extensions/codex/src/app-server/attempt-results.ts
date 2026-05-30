import type { EmbeddedRunAttemptResult } from "getkova/plugin-sdk/agent-harness-runtime";

const CODEX_APP_SERVER_MISSING_TERMINAL_EVENT_USER_MESSAGE =
  "Codex stopped before confirming the turn was complete. The response may be incomplete; retry if needed.";
const CODEX_APP_SERVER_MISSING_TERMINAL_EVENT_SIDE_EFFECT_USER_MESSAGE =
  "Codex stopped before confirming the turn was complete. Some work may already have been performed; verify the current state before retrying.";

export function collectTerminalAssistantText(result: EmbeddedRunAttemptResult): string {
  return result.assistantTexts.join("\n\n").trim();
}

export function hasCodexAppServerPotentialSideEffectEvidence(
  result: EmbeddedRunAttemptResult,
): boolean {
  return result.replayMetadata.hadPotentialSideEffects;
}

export function resolveCodexAppServerReplayBlockedReason(
  result: EmbeddedRunAttemptResult,
):
  | NonNullable<EmbeddedRunAttemptResult["codexAppServerFailure"]>["replayBlockedReason"]
  | undefined {
  if (result.replayMetadata.hadPotentialSideEffects) {
    return "potential_side_effect";
  }
  if (result.assistantTexts.some((text) => text.trim().length > 0)) {
    return "assistant_output";
  }
  if (
    result.toolMetas.length > 0 ||
    result.clientToolCall ||
    result.lastToolError ||
    result.didSendDeterministicApprovalPrompt
  ) {
    return "tool_activity";
  }
  if (result.itemLifecycle.startedCount > 0 || result.itemLifecycle.activeCount > 0) {
    return "active_item";
  }
  return undefined;
}

export function buildCodexAppServerPromptTimeoutOutcome(params: {
  result: EmbeddedRunAttemptResult;
  turnCompletionIdleTimedOut: boolean;
}): EmbeddedRunAttemptResult["promptTimeoutOutcome"] {
  const hadPotentialSideEffects = hasCodexAppServerPotentialSideEffectEvidence(params.result);
  const replayBlockedReason = resolveCodexAppServerReplayBlockedReason(params.result);
  if (
    !params.turnCompletionIdleTimedOut ||
    (params.result.itemLifecycle.completedCount === 0 &&
      !hadPotentialSideEffects &&
      replayBlockedReason === undefined)
  ) {
    return undefined;
  }
  return {
    message: hadPotentialSideEffects
      ? CODEX_APP_SERVER_MISSING_TERMINAL_EVENT_SIDE_EFFECT_USER_MESSAGE
      : CODEX_APP_SERVER_MISSING_TERMINAL_EVENT_USER_MESSAGE,
    ...(hadPotentialSideEffects
      ? {
          replayInvalid: true,
          livenessState: "abandoned" as const,
        }
      : {}),
  };
}
