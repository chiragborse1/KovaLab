import type { KovaConfig } from "../config/types.kova.js";
export declare function resolveInboundDebounceMs(params: {
    cfg: KovaConfig;
    channel: string;
    overrideMs?: number;
}): number;
export type InboundDebounceCreateParams<T> = {
    debounceMs: number;
    maxTrackedKeys?: number;
    buildKey: (item: T) => string | null | undefined;
    shouldDebounce?: (item: T) => boolean;
    resolveDebounceMs?: (item: T) => number | undefined;
    onFlush: (items: T[]) => Promise<void>;
    onError?: (err: unknown, items: T[]) => void;
};
export declare function createInboundDebouncer<T>(params: InboundDebounceCreateParams<T>): {
    enqueue: (item: T) => Promise<void>;
    flushKey: (key: string) => Promise<void>;
};
