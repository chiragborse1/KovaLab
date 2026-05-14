import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../agents/defaults.js";
import type { ModelCatalogEntry } from "../../agents/model-catalog.types.js";
import {
  buildAllowedModelSet,
  buildConfiguredModelCatalog,
  resolveConfiguredModelRef,
} from "../../agents/model-selection.js";
import type { OpenClawConfig } from "../../config/types.openclaw.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import { getCachedGatewayModelCatalog } from "../server-model-catalog.js";
import type { GatewayRequestHandlers } from "./types.js";

const MODELS_LIST_BACKGROUND_WARMUP_DELAY_MS = 500;
let modelsListBackgroundWarmupPending = false;

function catalogKey(entry: Pick<ModelCatalogEntry, "provider" | "id">): string {
  return `${entry.provider.trim().toLowerCase()}/${entry.id.trim().toLowerCase()}`;
}

function buildConfiguredFallbackCatalog(cfg: OpenClawConfig): ModelCatalogEntry[] {
  const catalog = buildConfiguredModelCatalog({ cfg });
  const configured = resolveConfiguredModelRef({
    cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
    allowPluginNormalization: true,
  });
  const current: ModelCatalogEntry = {
    provider: configured.provider,
    id: configured.model,
    name: configured.model,
  };
  const seen = new Set(catalog.map(catalogKey));
  if (!seen.has(catalogKey(current))) {
    catalog.push(current);
  }
  return catalog.sort((a, b) => {
    const provider = a.provider.localeCompare(b.provider);
    return provider === 0 ? a.name.localeCompare(b.name) : provider;
  });
}

function scheduleModelCatalogWarmup(loadGatewayModelCatalog: () => Promise<ModelCatalogEntry[]>) {
  if (modelsListBackgroundWarmupPending) {
    return;
  }
  modelsListBackgroundWarmupPending = true;
  const timer = setTimeout(() => {
    loadGatewayModelCatalog()
      .catch(() => undefined)
      .finally(() => {
        modelsListBackgroundWarmupPending = false;
      });
  }, MODELS_LIST_BACKGROUND_WARMUP_DELAY_MS);
  timer.unref?.();
}

function filterModelsForConfig(params: {
  cfg: OpenClawConfig;
  catalog: ModelCatalogEntry[];
}): ModelCatalogEntry[] {
  const { allowedCatalog } = buildAllowedModelSet({
    cfg: params.cfg,
    catalog: params.catalog,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  return allowedCatalog.length > 0 ? allowedCatalog : params.catalog;
}

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const cfg = context.getRuntimeConfig();
      const { preferCached } = params as { preferCached?: boolean };
      if (preferCached) {
        const cached = getCachedGatewayModelCatalog();
        if (cached && cached.length > 0) {
          respond(true, { models: filterModelsForConfig({ cfg, catalog: cached }) }, undefined);
          return;
        }
        scheduleModelCatalogWarmup(context.loadGatewayModelCatalog);
        const catalog = buildConfiguredFallbackCatalog(cfg);
        respond(
          true,
          { models: filterModelsForConfig({ cfg, catalog }), partial: true },
          undefined,
        );
        return;
      }

      const catalog = await context.loadGatewayModelCatalog();
      const models = filterModelsForConfig({ cfg, catalog });
      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
