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
export type TuiTraceSegment = {
    stage: string;
    durationMs: number;
};
export declare function isTuiTurnTraceEnabled(env?: NodeJS.ProcessEnv): boolean;
export declare function formatTuiTraceElapsed(ms: number): string;
export declare function formatTuiTurnTrace(payload: unknown): string;
export declare function buildTuiTraceSegments(marks: readonly TraceMark[], totalElapsedMs: number): TuiTraceSegment[];
export declare function summarizeTuiTraceSegments(segments: readonly TuiTraceSegment[]): {
    slowestDetail: string;
    budgetDetail?: string;
};
export declare class TuiTurnTrace {
    private readonly startedAt;
    private readonly enabled;
    private readonly runId;
    private readonly sessionKey;
    private readonly emit;
    private readonly marks;
    private summaryEmitted;
    constructor(opts: TuiTurnTraceOptions);
    step(stage: string, detail?: string): void;
    summary(status: string): void;
}
export {};
