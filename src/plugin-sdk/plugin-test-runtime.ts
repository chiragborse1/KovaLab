import { vi } from "vitest";
import type {
  ImageGenerationProviderPlugin,
  MediaUnderstandingProviderPlugin,
  MusicGenerationProviderPlugin,
  ProviderPlugin,
  RealtimeTranscriptionProviderPlugin,
  RealtimeVoiceProviderPlugin,
  SpeechProviderPlugin,
  VideoGenerationProviderPlugin,
  WebFetchProviderPlugin,
  WebSearchProviderPlugin,
} from "../plugins/types.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import type { KovaPluginApi } from "./plugin-runtime.js";
import { createTestPluginApi } from "./plugin-test-api.js";
import type { OutputRuntimeEnv } from "./runtime.js";

export type { WizardPrompter } from "../wizard/prompts.js";

type ProviderPluginModule = {
  register(api: KovaPluginApi): void;
};

export type RegisteredProviderCollections = {
  providers: ProviderPlugin[];
  realtimeTranscriptionProviders: RealtimeTranscriptionProviderPlugin[];
  realtimeVoiceProviders: RealtimeVoiceProviderPlugin[];
  speechProviders: SpeechProviderPlugin[];
  mediaProviders: MediaUnderstandingProviderPlugin[];
  imageProviders: ImageGenerationProviderPlugin[];
  musicProviders: MusicGenerationProviderPlugin[];
  videoProviders: VideoGenerationProviderPlugin[];
  webFetchProviders: WebFetchProviderPlugin[];
  webSearchProviders: WebSearchProviderPlugin[];
};

export function createRuntimeEnv(options?: { throwOnExit?: boolean }): OutputRuntimeEnv {
  const throwOnExit = options?.throwOnExit ?? true;
  return {
    log: vi.fn(),
    error: vi.fn(),
    writeStdout: vi.fn(),
    writeJson: vi.fn(),
    exit: throwOnExit
      ? vi.fn((code: number): never => {
          throw new Error(`exit ${code}`);
        })
      : vi.fn(),
  };
}

export function createTypedRuntimeEnv<TRuntime>(options?: { throwOnExit?: boolean }): TRuntime {
  return createRuntimeEnv(options) as TRuntime;
}

export function createNonExitingRuntimeEnv(): OutputRuntimeEnv {
  return createRuntimeEnv({ throwOnExit: false });
}

export function createNonExitingTypedRuntimeEnv<TRuntime>(): TRuntime {
  return createTypedRuntimeEnv<TRuntime>({ throwOnExit: false });
}

async function selectFirstWizardOption<T>(params: { options: Array<{ value: T }> }): Promise<T> {
  const first = params.options[0];
  if (!first) {
    throw new Error("no options");
  }
  return first.value;
}

export function createTestWizardPrompter(overrides: Partial<WizardPrompter> = {}): WizardPrompter {
  return {
    intro: vi.fn(async () => {}),
    outro: vi.fn(async () => {}),
    note: vi.fn(async () => {}),
    select: selectFirstWizardOption as WizardPrompter["select"],
    multiselect: vi.fn(async () => []),
    text: vi.fn(async () => "") as WizardPrompter["text"],
    confirm: vi.fn(async () => false),
    progress: vi.fn(() => ({ update: vi.fn(), stop: vi.fn() })),
    ...overrides,
  };
}

export async function registerProviderPlugin(params: {
  plugin: ProviderPluginModule;
  id: string;
  name: string;
}): Promise<RegisteredProviderCollections> {
  const providers: ProviderPlugin[] = [];
  const realtimeTranscriptionProviders: RealtimeTranscriptionProviderPlugin[] = [];
  const realtimeVoiceProviders: RealtimeVoiceProviderPlugin[] = [];
  const speechProviders: SpeechProviderPlugin[] = [];
  const mediaProviders: MediaUnderstandingProviderPlugin[] = [];
  const imageProviders: ImageGenerationProviderPlugin[] = [];
  const musicProviders: MusicGenerationProviderPlugin[] = [];
  const videoProviders: VideoGenerationProviderPlugin[] = [];
  const webFetchProviders: WebFetchProviderPlugin[] = [];
  const webSearchProviders: WebSearchProviderPlugin[] = [];

  params.plugin.register(
    createTestPluginApi({
      id: params.id,
      name: params.name,
      source: "test",
      config: {},
      runtime: {} as never,
      registerProvider: (provider) => {
        providers.push(provider);
      },
      registerRealtimeTranscriptionProvider: (provider) => {
        realtimeTranscriptionProviders.push(provider);
      },
      registerRealtimeVoiceProvider: (provider) => {
        realtimeVoiceProviders.push(provider);
      },
      registerSpeechProvider: (provider) => {
        speechProviders.push(provider);
      },
      registerMediaUnderstandingProvider: (provider) => {
        mediaProviders.push(provider);
      },
      registerImageGenerationProvider: (provider) => {
        imageProviders.push(provider);
      },
      registerMusicGenerationProvider: (provider) => {
        musicProviders.push(provider);
      },
      registerVideoGenerationProvider: (provider) => {
        videoProviders.push(provider);
      },
      registerWebFetchProvider: (provider) => {
        webFetchProviders.push(provider);
      },
      registerWebSearchProvider: (provider) => {
        webSearchProviders.push(provider);
      },
    }),
  );

  return {
    providers,
    realtimeTranscriptionProviders,
    realtimeVoiceProviders,
    speechProviders,
    mediaProviders,
    imageProviders,
    musicProviders,
    videoProviders,
    webFetchProviders,
    webSearchProviders,
  };
}

export async function registerSingleProviderPlugin(
  plugin: ProviderPluginModule,
): Promise<ProviderPlugin> {
  const { providers } = await registerProviderPlugin({
    plugin,
    id: "test-provider",
    name: "Test Provider",
  });
  return requireRegisteredProvider(providers, providers[0]?.id ?? "provider");
}

export function requireRegisteredProvider<T extends { id: string }>(
  entries: T[],
  id: string,
  label = "provider",
): T {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`${label} ${id} was not registered`);
  }
  return entry;
}
