import { afterEach, describe, expect, test, vi } from "vitest";
import type { ModelCatalogEntry } from "../../agents/model-catalog.types.js";
import type { KovaConfig } from "../../config/types.kova.js";
import { modelsHandlers } from "./models.js";
import type { GatewayRequestContext, RespondFn } from "./types.js";

vi.mock("../server-model-catalog.js", () => ({
  getCachedGatewayModelCatalog: vi.fn(() => undefined),
}));

function createHandlerContext(params: {
  config: KovaConfig;
  loadGatewayModelCatalog: () => Promise<ModelCatalogEntry[]>;
}): GatewayRequestContext {
  return {
    getRuntimeConfig: () => params.config,
    loadGatewayModelCatalog: params.loadGatewayModelCatalog,
  } as GatewayRequestContext;
}

describe("models.list handler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("returns a config-derived fallback for cached-preferred requests", async () => {
    vi.useFakeTimers();
    const config = {
      agents: {
        defaults: {
          model: { primary: "openrouter/auto" },
        },
      },
    } as KovaConfig;
    const loadGatewayModelCatalog = vi.fn(() => new Promise<ModelCatalogEntry[]>(() => undefined));
    const responses: Array<{
      ok: boolean;
      payload?: { models?: ModelCatalogEntry[]; partial?: boolean };
    }> = [];
    const respond: RespondFn = (ok, payload) => {
      responses.push({
        ok,
        payload: payload as { models?: ModelCatalogEntry[]; partial?: boolean } | undefined,
      });
    };

    await modelsHandlers["models.list"]({
      req: {
        type: "req",
        id: "models-1",
        method: "models.list",
        params: { preferCached: true },
      },
      params: { preferCached: true },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context: createHandlerContext({ config, loadGatewayModelCatalog }),
    });

    expect(loadGatewayModelCatalog).not.toHaveBeenCalled();
    expect(responses).toEqual([
      {
        ok: true,
        payload: {
          partial: true,
          models: [
            {
              provider: "openrouter",
              id: "openrouter/auto",
              name: "openrouter/auto",
            },
          ],
        },
      },
    ]);

    await vi.advanceTimersByTimeAsync(500);
    expect(loadGatewayModelCatalog).toHaveBeenCalledTimes(1);
  });
});
