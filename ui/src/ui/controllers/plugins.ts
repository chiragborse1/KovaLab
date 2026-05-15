import type { GatewayBrowserClient } from "../gateway.ts";
import type { PluginsInstallResult, PluginsMutationResult, PluginsStatusResult } from "../types.ts";

export type PluginOperationKind = "install" | "enable" | "disable" | "uninstall";

export type PluginOperationState = {
  kind: PluginOperationKind;
  label: string;
  startedAt: number;
};

export type PluginsStatusState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  pluginsStatusLoading: boolean;
  pluginsStatusResult: PluginsStatusResult | null;
  pluginsStatusError: string | null;
  pluginsOperation: PluginOperationState | null;
  pluginsInstallSpec: string;
};

export async function loadPluginsStatus(
  client: GatewayBrowserClient,
): Promise<PluginsStatusResult> {
  return client.request<PluginsStatusResult>("plugins.status", {});
}

export async function loadPluginsStatusState(state: PluginsStatusState): Promise<void> {
  if (!state.client || !state.connected || state.pluginsStatusLoading) {
    return;
  }
  state.pluginsStatusLoading = true;
  state.pluginsStatusError = null;
  try {
    state.pluginsStatusResult = await loadPluginsStatus(state.client);
  } catch (err) {
    state.pluginsStatusError = err instanceof Error ? err.message : String(err);
  } finally {
    state.pluginsStatusLoading = false;
  }
}

function operationLabel(kind: PluginOperationKind, target: string): string {
  switch (kind) {
    case "install":
      return `Installing ${target}`;
    case "enable":
      return `Enabling ${target}`;
    case "disable":
      return `Disabling ${target}`;
    case "uninstall":
      return `Removing ${target}`;
  }
  return target;
}

function beginPluginOperation(
  state: PluginsStatusState,
  kind: PluginOperationKind,
  target: string,
): void {
  state.pluginsOperation = {
    kind,
    label: operationLabel(kind, target),
    startedAt: Date.now(),
  };
  state.pluginsStatusError = null;
}

function finishPluginOperation(state: PluginsStatusState): void {
  state.pluginsOperation = null;
}

export async function setPluginEnabledState(
  state: PluginsStatusState,
  pluginId: string,
  enabled: boolean,
): Promise<PluginsMutationResult | null> {
  if (!state.client || !state.connected || state.pluginsOperation) {
    return null;
  }
  beginPluginOperation(state, enabled ? "enable" : "disable", pluginId);
  try {
    const result = await state.client.request<PluginsMutationResult>("plugins.setEnabled", {
      pluginId,
      enabled,
    });
    state.pluginsStatusResult = result.status;
    return result;
  } catch (err) {
    state.pluginsStatusError = err instanceof Error ? err.message : String(err);
    return null;
  } finally {
    finishPluginOperation(state);
  }
}

export async function uninstallPluginState(
  state: PluginsStatusState,
  pluginId: string,
): Promise<PluginsMutationResult | null> {
  if (!state.client || !state.connected || state.pluginsOperation) {
    return null;
  }
  beginPluginOperation(state, "uninstall", pluginId);
  try {
    const result = await state.client.request<PluginsMutationResult>("plugins.uninstall", {
      pluginId,
      deleteFiles: true,
    });
    state.pluginsStatusResult = result.status;
    return result;
  } catch (err) {
    state.pluginsStatusError = err instanceof Error ? err.message : String(err);
    return null;
  } finally {
    finishPluginOperation(state);
  }
}

export async function installPluginState(
  state: PluginsStatusState,
  spec?: string,
): Promise<PluginsInstallResult | null> {
  const resolvedSpec = (spec ?? state.pluginsInstallSpec).trim();
  if (!state.client || !state.connected || state.pluginsOperation || !resolvedSpec) {
    return null;
  }
  beginPluginOperation(state, "install", resolvedSpec);
  try {
    const result = await state.client.request<PluginsInstallResult>("plugins.install", {
      spec: resolvedSpec,
    });
    state.pluginsStatusResult = result.status;
    state.pluginsInstallSpec = "";
    return result;
  } catch (err) {
    state.pluginsStatusError = err instanceof Error ? err.message : String(err);
    return null;
  } finally {
    finishPluginOperation(state);
  }
}
