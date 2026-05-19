import { expect } from "vitest";
import type { KovaConfig } from "../config/config.js";
import type { ModelApi } from "../config/types.models.js";
import type { VideoGenerationProviderPlugin } from "../plugins/types.js";
import { listSupportedVideoGenerationModes } from "../video-generation/capabilities.js";
import type {
  RealtimeTranscriptionProviderConfig,
  RealtimeTranscriptionProviderPlugin,
} from "./realtime-transcription.js";

export const EXPECTED_FALLBACKS = ["anthropic/claude-opus-4-5"] as const;

export function createLegacyProviderConfig(params: {
  providerId: string;
  api: ModelApi;
  modelId?: string;
  modelName?: string;
  baseUrl?: string;
  apiKey?: string;
}): KovaConfig {
  return {
    models: {
      providers: {
        [params.providerId]: {
          baseUrl: params.baseUrl ?? "https://old.example.com",
          apiKey: params.apiKey ?? "old-key",
          api: params.api,
          models: [
            {
              id: params.modelId ?? "old-model",
              name: params.modelName ?? "Old",
              reasoning: false,
              input: ["text"],
              cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 1000,
              maxTokens: 100,
            },
          ],
        },
      },
    },
  } as KovaConfig;
}

export function createConfigWithFallbacks(): KovaConfig {
  return {
    agents: {
      defaults: {
        model: { fallbacks: [...EXPECTED_FALLBACKS] },
      },
    },
  };
}

function hasPositiveModeLimit(
  value: number | undefined,
  valuesByModel: Readonly<Record<string, number>> | undefined,
): boolean {
  return (
    (value ?? 0) > 0 ||
    Object.values(valuesByModel ?? {}).some(
      (modelValue) => Number.isFinite(modelValue) && modelValue > 0,
    )
  );
}

export function expectExplicitVideoGenerationCapabilities(
  provider: VideoGenerationProviderPlugin,
): void {
  expect(
    provider.capabilities.generate,
    `${provider.id} missing generate capabilities`,
  ).toBeDefined();
  expect(
    provider.capabilities.imageToVideo,
    `${provider.id} missing imageToVideo capabilities`,
  ).toBeDefined();
  expect(
    provider.capabilities.videoToVideo,
    `${provider.id} missing videoToVideo capabilities`,
  ).toBeDefined();

  const supportedModes = listSupportedVideoGenerationModes(provider);
  const imageToVideo = provider.capabilities.imageToVideo;
  const videoToVideo = provider.capabilities.videoToVideo;

  if (imageToVideo?.enabled) {
    expect(
      hasPositiveModeLimit(imageToVideo.maxInputImages, imageToVideo.maxInputImagesByModel),
      `${provider.id} imageToVideo.enabled requires maxInputImages or maxInputImagesByModel`,
    ).toBe(true);
    expect(supportedModes).toContain("imageToVideo");
  }
  if (videoToVideo?.enabled) {
    expect(
      hasPositiveModeLimit(videoToVideo.maxInputVideos, videoToVideo.maxInputVideosByModel),
      `${provider.id} videoToVideo.enabled requires maxInputVideos or maxInputVideosByModel`,
    ).toBe(true);
    expect(supportedModes).toContain("videoToVideo");
  }
}

export function normalizeTranscriptForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export const KOVA_LIVE_TRANSCRIPT_MARKER_RE = /kova/;

export function expectKovaLiveTranscriptMarker(value: string): void {
  expect(normalizeTranscriptForMatch(value)).toMatch(KOVA_LIVE_TRANSCRIPT_MARKER_RE);
}

type ExpectedTranscriptMatch = RegExp | string;

export async function waitForLiveExpectation(expectation: () => void, timeoutMs = 30_000) {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      expectation();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}

export async function streamAudioForLiveTest(params: {
  audio: Buffer;
  sendAudio: (chunk: Buffer) => void;
  chunkSize?: number;
  delayMs?: number;
}) {
  const chunkSize = params.chunkSize ?? 160;
  const delayMs = params.delayMs ?? 5;
  for (let offset = 0; offset < params.audio.byteLength; offset += chunkSize) {
    params.sendAudio(params.audio.subarray(offset, offset + chunkSize));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export async function runRealtimeSttLiveTest(params: {
  provider: RealtimeTranscriptionProviderPlugin;
  providerConfig: RealtimeTranscriptionProviderConfig;
  audio: Buffer;
  expectedNormalizedText?: ExpectedTranscriptMatch;
  timeoutMs?: number;
  closeBeforeWait?: boolean;
  chunkSize?: number;
  delayMs?: number;
}): Promise<{ transcripts: string[]; partials: string[]; errors: Error[] }> {
  const transcripts: string[] = [];
  const partials: string[] = [];
  const errors: Error[] = [];
  const expected = params.expectedNormalizedText ?? KOVA_LIVE_TRANSCRIPT_MARKER_RE;
  const session = params.provider.createSession({
    providerConfig: params.providerConfig,
    onPartial: (partial) => partials.push(partial),
    onTranscript: (transcript) => transcripts.push(transcript),
    onError: (error) => errors.push(error),
  });

  try {
    await session.connect();
    await streamAudioForLiveTest({
      audio: params.audio,
      sendAudio: (chunk) => session.sendAudio(chunk),
      chunkSize: params.chunkSize,
      delayMs: params.delayMs,
    });
    if (params.closeBeforeWait) {
      session.close();
    }

    await waitForLiveExpectation(() => {
      if (errors[0]) {
        throw errors[0];
      }
      const normalized = normalizeTranscriptForMatch(transcripts.join(" "));
      if (typeof expected === "string") {
        expect(normalized).toContain(expected);
      } else {
        expect(normalized).toMatch(expected);
      }
    }, params.timeoutMs ?? 60_000);
  } finally {
    session.close();
  }

  expect(partials.length + transcripts.length).toBeGreaterThan(0);
  return { transcripts, partials, errors };
}
