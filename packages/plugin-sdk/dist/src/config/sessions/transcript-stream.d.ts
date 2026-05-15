export type TranscriptStreamOptions = {
    signal?: AbortSignal;
};
export type TranscriptReverseStreamOptions = TranscriptStreamOptions & {
    /** Bytes read per reverse scan chunk. Clamped to [1KiB, 1MiB]. */
    chunkBytes?: number;
};
export declare function streamSessionTranscriptLines(filePath: string, options?: TranscriptStreamOptions): AsyncGenerator<string>;
export declare function streamSessionTranscriptLinesReverse(filePath: string, options?: TranscriptReverseStreamOptions): AsyncGenerator<string>;
