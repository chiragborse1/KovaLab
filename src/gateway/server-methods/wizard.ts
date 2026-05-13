import { randomUUID } from "node:crypto";
import { CONFIGURE_WIZARD_SECTIONS, type WizardSection } from "../../commands/configure.shared.js";
import { runConfigureWizard } from "../../commands/configure.wizard.js";
import { defaultRuntime } from "../../runtime.js";
import { readStringValue } from "../../shared/string-coerce.js";
import { WizardSession } from "../../wizard/session.js";
import {
  ErrorCodes,
  errorShape,
  validateWizardCancelParams,
  validateWizardNextParams,
  validateWizardStartParams,
  validateWizardStatusParams,
} from "../protocol/index.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestContext, GatewayRequestHandlers, RespondFn } from "./types.js";
import { assertValidParams } from "./validation.js";

function readWizardStatus(session: WizardSession) {
  return {
    status: session.getStatus(),
    error: session.getError(),
  };
}

function isWizardSection(value: string | undefined): value is WizardSection {
  return Boolean(value && CONFIGURE_WIZARD_SECTIONS.includes(value as WizardSection));
}

function findWizardSessionOrRespond(params: {
  context: GatewayRequestContext;
  respond: RespondFn;
  sessionId: string;
}): WizardSession | null {
  const session = params.context.wizardSessions.get(params.sessionId);
  if (!session) {
    params.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not found"));
    return null;
  }
  return session;
}

export const wizardHandlers: GatewayRequestHandlers = {
  "wizard.start": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateWizardStartParams, "wizard.start", respond)) {
      return;
    }
    const running = context.findRunningWizard();
    if (running) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "wizard already running"));
      return;
    }
    const flow = params.flow ?? "onboard";
    const sessionId = randomUUID();
    const session =
      flow === "configure"
        ? (() => {
            const section = readStringValue(params.section);
            if (!isWizardSection(section)) {
              respond(
                false,
                undefined,
                errorShape(ErrorCodes.INVALID_REQUEST, "configure wizard requires a valid section"),
              );
              return null;
            }
            return new WizardSession((prompter) =>
              runConfigureWizard(
                {
                  command: "configure",
                  sections: [section],
                  deferConfigReload: true,
                },
                defaultRuntime,
                prompter,
              ),
            );
          })()
        : new WizardSession((prompter) =>
            context.wizardRunner(
              {
                mode: params.mode,
                workspace: readStringValue(params.workspace),
                deferConfigReload: true,
                skipHealth: true,
                skipUi: true,
              },
              defaultRuntime,
              prompter,
            ),
          );
    if (!session) {
      return;
    }
    context.wizardSessions.set(sessionId, session);
    const result = await session.next();
    if (result.done) {
      context.purgeWizardSession(sessionId);
    }
    respond(true, { sessionId, ...result }, undefined);
  },
  "wizard.next": async ({ params, respond, context }) => {
    if (!assertValidParams(params, validateWizardNextParams, "wizard.next", respond)) {
      return;
    }
    const sessionId = params.sessionId;
    const session = findWizardSessionOrRespond({ context, respond, sessionId });
    if (!session) {
      return;
    }
    const answer = params.answer as { stepId?: string; value?: unknown } | undefined;
    if (answer) {
      if (session.getStatus() !== "running") {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "wizard not running"));
        return;
      }
      try {
        await session.answer(answer.stepId ?? "", answer.value);
      } catch (err) {
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, formatForLog(err)));
        return;
      }
    }
    const result = await session.next();
    if (result.done) {
      context.purgeWizardSession(sessionId);
    }
    respond(true, result, undefined);
  },
  "wizard.cancel": ({ params, respond, context }) => {
    if (!assertValidParams(params, validateWizardCancelParams, "wizard.cancel", respond)) {
      return;
    }
    const sessionId = params.sessionId;
    const session = findWizardSessionOrRespond({ context, respond, sessionId });
    if (!session) {
      return;
    }
    session.cancel();
    const status = readWizardStatus(session);
    context.wizardSessions.delete(sessionId);
    respond(true, status, undefined);
  },
  "wizard.status": ({ params, respond, context }) => {
    if (!assertValidParams(params, validateWizardStatusParams, "wizard.status", respond)) {
      return;
    }
    const sessionId = params.sessionId;
    const session = findWizardSessionOrRespond({ context, respond, sessionId });
    if (!session) {
      return;
    }
    const status = readWizardStatus(session);
    if (status.status !== "running") {
      context.wizardSessions.delete(sessionId);
    }
    respond(true, status, undefined);
  },
};
