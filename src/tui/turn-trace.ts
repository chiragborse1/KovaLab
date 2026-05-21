import { performance } from "node:perf_hooks";

const TRACE_ENABLED_VALUES = new Set(["1", "true", "yes", "on", "timing", "full"]);

export type TuiTurnTracePayload = {
  runId: string;
  sessionKey: string;
  stage: string;
  elapsedMs: number;
  detail?: string;
  ts: number;
};

type TuiTurnTraceOptions = {
  runId: string;
  sessionKey: string;
  enabled?: boolean;
  emit: (payload: TuiTurnTracePayload) => void;
};

export function isTuiTurnTraceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return TRACE_ENABLED_VALUES.has(env.KOVA_TUI_TRACE?.trim().toLowerCase() ?? "");
}

export function formatTuiTraceElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0ms";
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTuiTurnTrace(payload: unknown): string {
  const record = payload && typeof payload === "object" ? (payload as TuiTurnTracePayload) : null;
  const stage = typeof record?.stage === "string" && record.stage.trim() ? record.stage : "unknown";
  const detail =
    typeof record?.detail === "string" && record.detail.trim() ? ` | ${record.detail}` : "";
  const elapsedMs = typeof record?.elapsedMs === "number" ? record.elapsedMs : 0;
  return `trace ${stage} +${formatTuiTraceElapsed(elapsedMs)}${detail}`;
}

export class TuiTurnTrace {
  private readonly startedAt = performance.now();
  private readonly enabled: boolean;
  private readonly runId: string;
  private readonly sessionKey: string;
  private readonly emit: (payload: TuiTurnTracePayload) => void;

  constructor(opts: TuiTurnTraceOptions) {
    this.enabled = opts.enabled ?? isTuiTurnTraceEnabled();
    this.runId = opts.runId;
    this.sessionKey = opts.sessionKey;
    this.emit = opts.emit;
  }

  step(stage: string, detail?: string) {
    if (!this.enabled) {
      return;
    }
    this.emit({
      runId: this.runId,
      sessionKey: this.sessionKey,
      stage,
      elapsedMs: performance.now() - this.startedAt,
      ...(detail ? { detail } : {}),
      ts: Date.now(),
    });
  }
}
