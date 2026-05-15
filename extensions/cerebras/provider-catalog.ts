import type { ModelProviderConfig } from "getkova/plugin-sdk/provider-model-shared";
import {
  buildCerebrasModelDefinition,
  CEREBRAS_BASE_URL,
  CEREBRAS_MODEL_CATALOG,
} from "./models.js";

export function buildCerebrasProvider(): ModelProviderConfig {
  return {
    baseUrl: CEREBRAS_BASE_URL,
    api: "openai-completions",
    models: CEREBRAS_MODEL_CATALOG.map(buildCerebrasModelDefinition),
  };
}
