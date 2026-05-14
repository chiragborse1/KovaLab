import type { GatewayBrowserClient } from "../gateway.ts";
import type { PluginsStatusResult } from "../types.ts";

export type PluginsStatusState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  pluginsStatusLoading: boolean;
  pluginsStatusResult: PluginsStatusResult | null;
  pluginsStatusError: string | null;
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
