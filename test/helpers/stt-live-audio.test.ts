import { describe, expect, it } from "vitest";
import { normalizeTranscriptForMatch } from "./stt-live-audio.js";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common Kova live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Kova integration OK")).toBe("kovaintegrationok");
    expect(normalizeTranscriptForMatch("Testing Kova realtime transcription")).toMatch(/kova/);
  });
});
