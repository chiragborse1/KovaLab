export type VoiceKovaClientEvent =
  | VoiceKovaSessionConfigEvent
  | VoiceKovaAudioAppendEvent
  | VoiceKovaAudioCommitEvent
  | VoiceKovaFrameAppendEvent
  | VoiceKovaResponseCreateEvent
  | VoiceKovaResponseCancelEvent
  | VoiceKovaToolResultEvent;

export type VoiceKovaSessionConfigEvent = {
  type: "session.config";
  provider?: "openai" | "gemini";
  voice?: string;
  model?: string;
  brainAgent?: "enabled" | "none";
  apiKey?: string;
  sessionKey?: string;
  userId?: string;
  deviceContext?: {
    timezone?: string;
    locale?: string;
    deviceModel?: string;
    location?: string;
  };
  watchdog?: "enabled" | "disabled";
  instructionsOverride?: string;
  conversationHistory?: { role: "user" | "assistant"; text: string }[];
};

export type VoiceKovaAudioAppendEvent = {
  type: "audio.append";
  data: string;
};

export type VoiceKovaAudioCommitEvent = {
  type: "audio.commit";
};

export type VoiceKovaFrameAppendEvent = {
  type: "frame.append";
  data: string;
  mimeType?: string;
};

export type VoiceKovaResponseCreateEvent = {
  type: "response.create";
};

export type VoiceKovaResponseCancelEvent = {
  type: "response.cancel";
};

export type VoiceKovaToolResultEvent = {
  type: "tool.result";
  callId: string;
  output: string;
};

export type VoiceKovaServerEvent =
  | VoiceKovaSessionReadyEvent
  | VoiceKovaAudioDeltaEvent
  | VoiceKovaTranscriptDeltaEvent
  | VoiceKovaTranscriptDoneEvent
  | VoiceKovaToolCallEvent
  | VoiceKovaToolProgressEvent
  | VoiceKovaTurnStartedEvent
  | VoiceKovaTurnEndedEvent
  | VoiceKovaSessionEndedEvent
  | VoiceKovaSessionRotatingEvent
  | VoiceKovaSessionRotatedEvent
  | VoiceKovaUsageMetricsEvent
  | VoiceKovaLatencyMetricsEvent
  | VoiceKovaToolCancelledEvent
  | VoiceKovaErrorEvent;

export type VoiceKovaSessionReadyEvent = {
  type: "session.ready";
  sessionId: string;
};

export type VoiceKovaAudioDeltaEvent = {
  type: "audio.delta";
  data: string;
};

export type VoiceKovaTranscriptDeltaEvent = {
  type: "transcript.delta";
  text: string;
  role: "user" | "assistant";
};

export type VoiceKovaTranscriptDoneEvent = {
  type: "transcript.done";
  text: string;
  role: "user" | "assistant";
};

export type VoiceKovaToolCallEvent = {
  type: "tool.call";
  callId: string;
  name: string;
  arguments: string;
};

export type VoiceKovaToolProgressEvent = {
  type: "tool.progress";
  callId: string;
  summary: string;
};

export type VoiceKovaTurnStartedEvent = {
  type: "turn.started";
  turnId?: string;
};

export type VoiceKovaTurnEndedEvent = {
  type: "turn.ended";
};

export type VoiceKovaSessionEndedEvent = {
  type: "session.ended";
  summary: string;
  durationSec: number;
  turnCount: number;
};

export type VoiceKovaSessionRotatingEvent = {
  type: "session.rotating";
};

export type VoiceKovaSessionRotatedEvent = {
  type: "session.rotated";
  sessionId: string;
};

export type VoiceKovaUsageMetricsEvent = {
  type: "usage.metrics";
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputAudioTokens?: number;
  outputAudioTokens?: number;
};

export type VoiceKovaLatencyMetricsEvent = {
  type: "latency.metrics";
  endpointMs?: number;
  endpointSource?: string;
  providerFirstByteMs?: number;
  firstAudioFromTurnStartMs?: number;
  firstTextFromTurnStartMs?: number;
  firstOutputFromTurnStartMs?: number;
  firstOutputModality?: string;
};

export type VoiceKovaToolCancelledEvent = {
  type: "tool.cancelled";
  callIds: string[];
};

export type VoiceKovaErrorEvent = {
  type: "error";
  message: string;
  code: number;
};

export type VoiceKovaSendToClient = (event: VoiceKovaServerEvent) => void;

export type VoiceKovaRealtimeToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type VoiceKovaRealtimeAdapterOptions = {
  tools?: VoiceKovaRealtimeToolDeclaration[];
};

export type VoiceKovaRealtimeAdapter = {
  connect(
    config: VoiceKovaSessionConfigEvent,
    sendToClient: VoiceKovaSendToClient,
    options?: VoiceKovaRealtimeAdapterOptions,
  ): Promise<void>;
  sendAudio(data: string): void;
  commitAudio(): void;
  sendFrame(data: string, mimeType?: string): void;
  createResponse(): void;
  cancelResponse(): void;
  beginAsyncToolCall(callId: string): void;
  finishAsyncToolCall(callId: string): void;
  sendToolResult(callId: string, output: string): void;
  injectContext(text: string): void;
  getTranscript(): { role: "user" | "assistant"; text: string }[];
  disconnect(): void;
};
