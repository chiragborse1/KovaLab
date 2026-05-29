import type { KovaConfig } from "../config/types.kova.js";
import { resolveSecretInputRef } from "../config/types.secrets.js";
import {
  analyzeCommandSecretAssignmentsFromSnapshot,
  collectCommandSecretAssignmentsFromSnapshot,
  type CommandSecretAssignment,
} from "./command-config.js";
import { setPathExistingStrict } from "./path-utils.js";
import { resolveSecretRefValue } from "./resolve.js";
import { createResolverContext } from "./runtime-shared.js";
import { getActiveSecretsRuntimeSnapshot } from "./runtime.js";
import { assertExpectedResolvedSecretValue } from "./secret-value.js";
import { discoverConfigSecretTargetsByIds } from "./target-registry.js";

export type { CommandSecretAssignment } from "./command-config.js";

export function resolveCommandSecretsFromActiveRuntimeSnapshot(params: {
  commandName: string;
  targetIds: ReadonlySet<string>;
  allowedPaths?: ReadonlySet<string>;
  forcedActivePaths?: ReadonlySet<string>;
  optionalActivePaths?: ReadonlySet<string>;
}): Promise<{
  assignments: CommandSecretAssignment[];
  diagnostics: string[];
  inactiveRefPaths: string[];
}> {
  const activeSnapshot = getActiveSecretsRuntimeSnapshot();
  if (!activeSnapshot) {
    throw new Error("Secrets runtime snapshot is not active.");
  }
  if (params.targetIds.size === 0) {
    return Promise.resolve({ assignments: [], diagnostics: [], inactiveRefPaths: [] });
  }
  return resolveCommandSecretsFromSnapshot({
    sourceConfig: activeSnapshot.sourceConfig,
    resolvedConfig: activeSnapshot.config,
    warnings: activeSnapshot.warnings,
    commandName: params.commandName,
    targetIds: params.targetIds,
    allowedPaths: params.allowedPaths,
    forcedActivePaths: params.forcedActivePaths,
    optionalActivePaths: params.optionalActivePaths,
  });
}

async function resolveForcedActiveCommandSecretTargets(params: {
  sourceConfig: KovaConfig;
  resolvedConfig: KovaConfig;
  targetIds: ReadonlySet<string>;
  allowedPaths?: ReadonlySet<string>;
  forcedActivePaths?: ReadonlySet<string>;
  optionalActivePaths?: ReadonlySet<string>;
}): Promise<void> {
  const activePaths = new Set([
    ...(params.forcedActivePaths ?? []),
    ...(params.optionalActivePaths ?? []),
  ]);
  if (activePaths.size === 0) {
    return;
  }
  const context = createResolverContext({
    sourceConfig: params.sourceConfig,
    env: process.env,
  });
  const defaults = params.sourceConfig.secrets?.defaults;
  for (const target of discoverConfigSecretTargetsByIds(params.sourceConfig, params.targetIds)) {
    if (params.allowedPaths && !params.allowedPaths.has(target.path)) {
      continue;
    }
    if (!activePaths.has(target.path)) {
      continue;
    }
    const { ref } = resolveSecretInputRef({
      value: target.value,
      refValue: target.refValue,
      defaults,
    });
    if (!ref) {
      continue;
    }
    try {
      const resolved = await resolveSecretRefValue(ref, {
        config: params.sourceConfig,
        env: context.env,
        cache: context.cache,
      });
      assertExpectedResolvedSecretValue({
        value: resolved,
        expected: target.entry.expectedResolvedValue,
        errorMessage:
          target.entry.expectedResolvedValue === "string"
            ? `${target.path} resolved to a non-string or empty value.`
            : `${target.path} resolved to an unsupported value type.`,
      });
      setPathExistingStrict(params.resolvedConfig, target.pathSegments, resolved);
    } catch {
      // Leave unresolved; the CLI can still attempt local fallback for incomplete snapshots.
    }
  }
}

async function resolveCommandSecretsFromSnapshot(params: {
  sourceConfig: KovaConfig;
  resolvedConfig: KovaConfig;
  warnings: Array<{ code: string; path: string }>;
  commandName: string;
  targetIds: ReadonlySet<string>;
  allowedPaths?: ReadonlySet<string>;
  forcedActivePaths?: ReadonlySet<string>;
  optionalActivePaths?: ReadonlySet<string>;
}): Promise<{
  assignments: CommandSecretAssignment[];
  diagnostics: string[];
  inactiveRefPaths: string[];
}> {
  const resolvedConfig = structuredClone(params.resolvedConfig);
  await resolveForcedActiveCommandSecretTargets({
    sourceConfig: params.sourceConfig,
    resolvedConfig,
    targetIds: params.targetIds,
    allowedPaths: params.allowedPaths,
    forcedActivePaths: params.forcedActivePaths,
    optionalActivePaths: params.optionalActivePaths,
  });

  let inactiveRefPaths = [
    ...new Set(
      params.warnings
        .filter((warning) => warning.code === "SECRETS_REF_IGNORED_INACTIVE_SURFACE")
        .filter((warning) => !params.allowedPaths || params.allowedPaths.has(warning.path))
        .filter((warning) => !params.forcedActivePaths?.has(warning.path))
        .filter((warning) => !params.optionalActivePaths?.has(warning.path))
        .map((warning) => warning.path),
    ),
  ];
  let analyzed = analyzeCommandSecretAssignmentsFromSnapshot({
    sourceConfig: params.sourceConfig,
    resolvedConfig,
    targetIds: params.targetIds,
    inactiveRefPaths: new Set(inactiveRefPaths),
    ...(params.allowedPaths ? { allowedPaths: params.allowedPaths } : {}),
  });
  const optionalActiveUnresolvedPaths = analyzed.unresolved
    .filter((entry) => params.optionalActivePaths?.has(entry.path))
    .map((entry) => entry.path);
  if (optionalActiveUnresolvedPaths.length > 0) {
    inactiveRefPaths = [...new Set([...inactiveRefPaths, ...optionalActiveUnresolvedPaths])];
    analyzed = analyzeCommandSecretAssignmentsFromSnapshot({
      sourceConfig: params.sourceConfig,
      resolvedConfig,
      targetIds: params.targetIds,
      inactiveRefPaths: new Set(inactiveRefPaths),
      ...(params.allowedPaths ? { allowedPaths: params.allowedPaths } : {}),
    });
  }
  const forcedActiveUnresolved = analyzed.unresolved.filter((entry) =>
    params.forcedActivePaths?.has(entry.path),
  );
  if (forcedActiveUnresolved.length > 0) {
    return {
      assignments: analyzed.assignments,
      diagnostics: analyzed.diagnostics,
      inactiveRefPaths,
    };
  }
  const resolved = collectCommandSecretAssignmentsFromSnapshot({
    sourceConfig: params.sourceConfig,
    resolvedConfig,
    commandName: params.commandName,
    targetIds: params.targetIds,
    inactiveRefPaths: new Set(inactiveRefPaths),
    ...(params.allowedPaths ? { allowedPaths: params.allowedPaths } : {}),
  });
  return {
    assignments: resolved.assignments,
    diagnostics: resolved.diagnostics,
    inactiveRefPaths,
  };
}
