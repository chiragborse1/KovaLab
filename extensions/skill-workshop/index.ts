import { resolveLivePluginConfigObject, type KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { definePluginEntry, resolveDefaultAgentId, type KovaPluginApi } from "./api.js";
import { resolveConfig } from "./src/config.js";
import { runSkillCurator, shouldRunCurator } from "./src/curator.js";
import { buildWorkshopGuidance } from "./src/prompt.js";
import { countToolCalls, reviewTranscriptForProposal } from "./src/reviewer.js";
import { createProposalFromMessages } from "./src/signals.js";
import type { SkillWorkshopStore } from "./src/store.js";
import { createSkillWorkshopTool } from "./src/tool.js";
import { applyOrStoreProposal, createStoreForContext } from "./src/workshop.js";

const SKILL_WORKSHOP_CLI_DESCRIPTOR = {
  name: "skill-workshop",
  description: "Review Skill Workshop workspace skill proposals",
  hasSubcommands: true,
};

export default definePluginEntry({
  id: "skill-workshop",
  name: "Skill Workshop",
  description:
    "Captures repeatable workflows as workspace skills, with pending review and safe writes.",
  register(api) {
    const resolveCurrentConfig = () => {
      const runtimePluginConfig = resolveLivePluginConfigObject(
        api.runtime.config?.current ? () => api.runtime.config.current() as KovaConfig : undefined,
        "skill-workshop",
        api.pluginConfig as Record<string, unknown>,
      );
      return resolveConfig(runtimePluginConfig);
    };

    api.registerCli(
      async ({ program, config, workspaceDir }) => {
        const { registerSkillWorkshopCli } = await import("./src/cli.js");
        registerSkillWorkshopCli(program, { config, workspaceDir });
      },
      {
        commands: ["skill-workshop"],
        descriptors: [SKILL_WORKSHOP_CLI_DESCRIPTOR],
      },
    );

    api.registerTool(
      (ctx) => {
        const config = resolveCurrentConfig();
        if (!config.enabled) {
          return null;
        }
        return createSkillWorkshopTool({ api, config, ctx });
      },
      {
        name: "skill_workshop",
      },
    );

    api.on("before_prompt_build", async () => {
      const config = resolveCurrentConfig();
      if (!config.enabled) {
        return undefined;
      }
      return {
        prependSystemContext: buildWorkshopGuidance(config),
      };
    });

    api.on("agent_end", async (event, ctx) => {
      const config = resolveCurrentConfig();
      if (!config.enabled) {
        return;
      }
      if (!event.success) {
        return;
      }
      if (ctx.sessionId?.startsWith("skill-workshop-review-")) {
        return;
      }
      if (!config.autoCapture || config.reviewMode === "off") {
        return;
      }
      scheduleBackgroundCapture({
        api,
        task: async () => {
          await runPostTurnCapture({ api, config, event, ctx });
        },
      });
    });
  },
});

function scheduleBackgroundCapture(params: {
  api: KovaPluginApi;
  task: () => Promise<void>;
}): void {
  const timer = setTimeout(() => {
    void params.task().catch((error) => {
      params.api.logger.warn(`skill-workshop: background capture skipped: ${String(error)}`);
    });
  }, 0);
  timer.unref?.();
}

async function runPostTurnCapture(params: {
  api: KovaPluginApi;
  config: ReturnType<typeof resolveConfig>;
  event: {
    messages: unknown[];
  };
  ctx: {
    agentId?: string;
    sessionId?: string;
    sessionKey?: string;
    workspaceDir?: string;
    modelProviderId?: string;
    modelId?: string;
    messageProvider?: string;
    channelId?: string;
  };
}): Promise<void> {
  const { api, config, event, ctx } = params;
  const agentId = ctx.agentId ?? resolveDefaultAgentId(api.config);
  const workspaceDir =
    ctx.workspaceDir || api.runtime.agent.resolveAgentWorkspaceDir(api.config, agentId);
  const store = createStoreForContext({ api, ctx: { ...ctx, workspaceDir }, config });
  const heuristicProposal = createProposalFromMessages({
    messages: event.messages,
    workspaceDir,
    agentId,
    sessionId: ctx.sessionId,
  });
  const heuristicEnabled = config.reviewMode === "heuristic" || config.reviewMode === "hybrid";
  if (heuristicEnabled && heuristicProposal) {
    try {
      const result = await applyOrStoreProposal({
        proposal: heuristicProposal,
        store,
        config,
        workspaceDir,
      });
      if (result.status === "applied") {
        api.logger.info(`skill-workshop: applied ${heuristicProposal.skillName}`);
      } else if (result.status === "quarantined") {
        api.logger.warn(`skill-workshop: quarantined ${heuristicProposal.skillName}`);
      } else {
        api.logger.info(`skill-workshop: queued ${heuristicProposal.skillName}`);
      }
    } catch (error) {
      api.logger.warn(`skill-workshop: heuristic capture skipped: ${String(error)}`);
    }
  }

  const llmEnabled = config.reviewMode === "llm" || config.reviewMode === "hybrid";
  if (!llmEnabled) {
    await maybeRunCurator({ api, config, store, workspaceDir });
    return;
  }
  const reviewState = await store.recordReviewTurn(countToolCalls(event.messages));
  const thresholdMet =
    reviewState.turnsSinceReview >= config.reviewInterval ||
    reviewState.toolCallsSinceReview >= config.reviewMinToolCalls;
  const shouldReview =
    thresholdMet || (config.reviewMode === "llm" && heuristicProposal !== undefined);
  if (!shouldReview) {
    await maybeRunCurator({ api, config, store, workspaceDir });
    return;
  }
  await store.markReviewed();
  try {
    const proposal = await reviewTranscriptForProposal({
      api,
      config,
      messages: event.messages,
      ctx: {
        agentId,
        sessionId: ctx.sessionId,
        sessionKey: ctx.sessionKey,
        workspaceDir,
        modelProviderId: ctx.modelProviderId,
        modelId: ctx.modelId,
        messageProvider: ctx.messageProvider,
        channelId: ctx.channelId,
      },
    });
    if (!proposal) {
      api.logger.debug?.("skill-workshop: reviewer found no update");
      await maybeRunCurator({ api, config, store, workspaceDir });
      return;
    }
    const result = await applyOrStoreProposal({ proposal, store, config, workspaceDir });
    if (result.status === "applied") {
      api.logger.info(`skill-workshop: applied ${proposal.skillName}`);
    } else if (result.status === "quarantined") {
      api.logger.warn(`skill-workshop: quarantined ${proposal.skillName}`);
    } else {
      api.logger.info(`skill-workshop: queued ${proposal.skillName}`);
    }
  } catch (error) {
    api.logger.warn(`skill-workshop: reviewer skipped: ${String(error)}`);
  }
  await maybeRunCurator({ api, config, store, workspaceDir });
}

async function maybeRunCurator(params: {
  api: KovaPluginApi;
  config: ReturnType<typeof resolveConfig>;
  store: SkillWorkshopStore;
  workspaceDir: string;
}): Promise<void> {
  if (!params.config.curatorEnabled) {
    return;
  }
  const state = await params.store.recordCuratorTurn();
  if (
    !shouldRunCurator({
      enabled: params.config.curatorEnabled,
      turnsSinceRun: state.turnsSinceRun,
      intervalTurns: params.config.curatorIntervalTurns,
    })
  ) {
    return;
  }
  try {
    const result = await runSkillCurator({
      store: params.store,
      stateDir: params.api.runtime.state.resolveStateDir(),
      workspaceDir: params.workspaceDir,
      config: {
        enabled: params.config.curatorEnabled,
        intervalTurns: params.config.curatorIntervalTurns,
        minSkillAgeDays: params.config.curatorMinSkillAgeDays,
        staleDays: params.config.curatorStaleDays,
        archiveDays: params.config.curatorArchiveDays,
        maxActions: params.config.curatorMaxActions,
      },
      apply: true,
    });
    const changed = result.report.actions.filter((action) => action.type !== "keep").length;
    params.api.logger.info(
      `skill-workshop: curator checked ${String(result.report.checked)} skills, ${String(
        changed,
      )} changes`,
    );
  } catch (error) {
    params.api.logger.warn(`skill-workshop: curator skipped: ${String(error)}`);
  }
}

export { createProposalFromMessages } from "./src/signals.js";
export { SkillWorkshopStore } from "./src/store.js";
export { applyProposalToWorkspace, normalizeSkillName } from "./src/skills.js";
export { countToolCalls, reviewTranscriptForProposal } from "./src/reviewer.js";
export { scanSkillContent } from "./src/scanner.js";
export { runSkillCurator } from "./src/curator.js";
