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

type TraceMark = {
  stage: string;
  elapsedMs: number;
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

function classifySlowTraceSegment(stage: string): string {
  if (/agent\.dispatch/i.test(stage)) {
    return "provider/model runtime";
  }
  if (/agent\.imports|command\.pipeline\.import/i.test(stage)) {
    return "cold imports";
  }
  if (/session\.load|history/i.test(stage)) {
    return "session/history I/O";
  }
  if (/command\.pipeline/i.test(stage)) {
    return "slash-command pipeline";
  }
  return "runtime";
}

export class TuiTurnTrace {
  private readonly startedAt = performance.now();
  private readonly enabled: boolean;
  private readonly runId: string;
  private readonly sessionKey: string;
  private readonly emit: (payload: TuiTurnTracePayload) => void;
  private readonly marks: TraceMark[] = [];
  private summaryEmitted = false;

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
    const elapsedMs = performance.now() - this.startedAt;
    this.marks.push({ stage, elapsedMs });
    this.emit({
      runId: this.runId,
      sessionKey: this.sessionKey,
      stage,
      elapsedMs,
      ...(detail ? { detail } : {}),
      ts: Date.now(),
    });
  }

  summary(status: string) {
    if (!this.enabled || this.summaryEmitted) {
      return;
    }
    this.summaryEmitted = true;
    const elapsedMs = performance.now() - this.startedAt;
    const marks = this.marks.length > 0 ? this.marks : [{ stage: "start", elapsedMs: 0 }];
    const segments = marks.map((mark, index) => {
      const next = marks[index + 1]?.elapsedMs ?? elapsedMs;
      return {
        stage: mark.stage,
        durationMs: Math.max(0, next - mark.elapsedMs),
      };
    });
    const slowest = segments.toSorted((a, b) => b.durationMs - a.durationMs)[0];
    const slowestDetail = slowest
      ? `slowest ${slowest.stage} ${formatTuiTraceElapsed(slowest.durationMs)} (${classifySlowTraceSegment(slowest.stage)})`
      : "slowest unknown";
    this.emit({
      runId: this.runId,
      sessionKey: this.sessionKey,
      stage: "summary",
      elapsedMs,
      detail: `${status} | ${slowestDetail}`,
      ts: Date.now(),
    });
  }
}
