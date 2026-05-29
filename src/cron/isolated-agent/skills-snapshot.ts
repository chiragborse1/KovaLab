import type { SkillSnapshot } from "../../agents/skills.js";
import type { KovaConfig } from "../../config/types.kova.js";

let skillsSnapshotRuntimePromise:
  | Promise<typeof import("./skills-snapshot.runtime.js")>
  | undefined;

async function loadSkillsSnapshotRuntime() {
  skillsSnapshotRuntimePromise ??= import("./skills-snapshot.runtime.js");
  return await skillsSnapshotRuntimePromise;
}

export async function resolveCronSkillsSnapshot(params: {
  workspaceDir: string;
  config: KovaConfig;
  agentId: string;
  existingSnapshot?: SkillSnapshot;
  isFastTestEnv: boolean;
}): Promise<SkillSnapshot> {
  if (params.isFastTestEnv) {
    // Fast unit-test mode skips filesystem scans and snapshot refresh writes.
    return params.existingSnapshot ?? { prompt: "", skills: [] };
  }

  const runtime = await loadSkillsSnapshotRuntime();
  const skillFilter = runtime.resolveAgentSkillsFilter(params.config, params.agentId);
  return runtime.resolveReusableWorkspaceSkillSnapshot({
    workspaceDir: params.workspaceDir,
    config: params.config,
    agentId: params.agentId,
    existingSnapshot: params.existingSnapshot,
    skillFilter,
    eligibility: {
      remote: runtime.getRemoteSkillEligibility({
        advertiseExecNode: runtime.canExecRequestNode({
          cfg: params.config,
          agentId: params.agentId,
        }),
      }),
    },
    watch: false,
    hydrateExisting: false,
  }).snapshot;
}
