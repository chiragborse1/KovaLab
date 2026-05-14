import type { GatewayBrowserClient } from "../gateway.ts";
import type { ModelCatalogEntry } from "../types.ts";

export type ModelsListResponse = {
  models: ModelCatalogEntry[];
  partial?: boolean;
};

/**
 * Fetch the model catalog from the gateway.
 *
 * Accepts a {@link GatewayBrowserClient} (matching the existing ui/ controller
 * convention).  Returns an array of {@link ModelCatalogEntry}; on failure the
 * caller receives an empty array rather than throwing.
 */
export async function loadModelsResult(
  client: GatewayBrowserClient,
  opts?: { preferCached?: boolean },
): Promise<ModelsListResponse> {
  try {
    const result = await client.request<ModelsListResponse>("models.list", {
      preferCached: opts?.preferCached ?? true,
    });
    return {
      models: result?.models ?? [],
      partial: result?.partial === true,
    };
  } catch {
    return { models: [] };
  }
}

export async function loadModels(client: GatewayBrowserClient): Promise<ModelCatalogEntry[]> {
  return (await loadModelsResult(client)).models;
}
