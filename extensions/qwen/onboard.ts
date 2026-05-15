import {
  createModelCatalogPresetAppliers,
  type KovaConfig,
} from "getkova/plugin-sdk/provider-onboard";
import {
  QWEN_CN_BASE_URL,
  QWEN_DEFAULT_MODEL_REF,
  QWEN_GLOBAL_BASE_URL,
  QWEN_STANDARD_CN_BASE_URL,
  QWEN_STANDARD_GLOBAL_BASE_URL,
} from "./models.js";
import { buildQwenProvider } from "./provider-catalog.js";

export {
  QWEN_CN_BASE_URL,
  QWEN_DEFAULT_MODEL_REF,
  QWEN_GLOBAL_BASE_URL,
  QWEN_STANDARD_CN_BASE_URL,
  QWEN_STANDARD_GLOBAL_BASE_URL,
};

const qwenPresetAppliers = createModelCatalogPresetAppliers<[string]>({
  primaryModelRef: QWEN_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: KovaConfig, baseUrl: string) => {
    const provider = buildQwenProvider({ baseUrl });
    return {
      providerId: "qwen",
      api: provider.api ?? "openai-completions",
      baseUrl,
      catalogModels: provider.models ?? [],
      aliases: [
        ...(provider.models ?? []).flatMap((model) => [
          `qwen/${model.id}`,
          `modelstudio/${model.id}`,
        ]),
        { modelRef: QWEN_DEFAULT_MODEL_REF, alias: "Qwen" },
      ],
    };
  },
});

export function applyQwenProviderConfig(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyProviderConfig(cfg, QWEN_GLOBAL_BASE_URL);
}

export function applyQwenProviderConfigCn(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyProviderConfig(cfg, QWEN_CN_BASE_URL);
}

export function applyQwenConfig(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_GLOBAL_BASE_URL);
}

export function applyQwenConfigCn(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_CN_BASE_URL);
}

export function applyQwenStandardProviderConfig(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyProviderConfig(cfg, QWEN_STANDARD_GLOBAL_BASE_URL);
}

export function applyQwenStandardProviderConfigCn(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyProviderConfig(cfg, QWEN_STANDARD_CN_BASE_URL);
}

export function applyQwenStandardConfig(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_STANDARD_GLOBAL_BASE_URL);
}

export function applyQwenStandardConfigCn(cfg: KovaConfig): KovaConfig {
  return qwenPresetAppliers.applyConfig(cfg, QWEN_STANDARD_CN_BASE_URL);
}

export const applyModelStudioProviderConfig = applyQwenProviderConfig;
export const applyModelStudioProviderConfigCn = applyQwenProviderConfigCn;
export const applyModelStudioConfig = applyQwenConfig;
export const applyModelStudioConfigCn = applyQwenConfigCn;
export const applyModelStudioStandardProviderConfig = applyQwenStandardProviderConfig;
export const applyModelStudioStandardProviderConfigCn = applyQwenStandardProviderConfigCn;
export const applyModelStudioStandardConfig = applyQwenStandardConfig;
export const applyModelStudioStandardConfigCn = applyQwenStandardConfigCn;
