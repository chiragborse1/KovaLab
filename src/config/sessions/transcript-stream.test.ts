import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  streamSessionTranscriptLines,
  streamSessionTranscriptLinesReverse,
} from "./transcript-stream.js";

let tempDir = "";
let transcriptPath = "";

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "transcript-stream-"));
  transcriptPath = path.join(tempDir, "session.jsonl");
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

async function collect(iter: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const value of iter) {
    out.push(value);
  }
  return out;
}

describe("streamSessionTranscriptLines", () => {
  it("yields trimmed non-empty lines in file order", async () => {
    fs.writeFileSync(transcriptPath, "  alpha  \n\nbeta\n  \r\ngamma\n", "utf-8");

    const lines = await collect(streamSessionTranscriptLines(transcriptPath));

    expect(lines).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns an empty iterator when the file does not exist", async () => {
    const lines = await collect(streamSessionTranscriptLines(path.join(tempDir, "missing.jsonl")));

    expect(lines).toEqual([]);
  });

  it("honours an abort signal between lines", async () => {
    fs.writeFileSync(transcriptPath, "one\ntwo\nthree\n", "utf-8");
    const controller = new AbortController();

    const out: string[] = [];
    for await (const line of streamSessionTranscriptLines(transcriptPath, {
      signal: controller.signal,
    })) {
      out.push(line);
      if (line === "one") {
        controller.abort();
      }
    }

    expect(out).toEqual(["one"]);
  });
});

describe("streamSessionTranscriptLinesReverse", () => {
  it("yields trimmed non-empty lines in reverse order for short files", async () => {
    fs.writeFileSync(transcriptPath, "first\nsecond\nthird\n", "utf-8");

    const lines = await collect(streamSessionTranscriptLinesReverse(transcriptPath));

    expect(lines).toEqual(["third", "second", "first"]);
  });

  it("preserves complete lines across chunk boundaries", async () => {
    const longLine = "x".repeat(2048);
    fs.writeFileSync(transcriptPath, `${longLine}\nbeta\ngamma\n`, "utf-8");

    const lines = await collect(
      streamSessionTranscriptLinesReverse(transcriptPath, {
        chunkBytes: 1024,
      }),
    );

    expect(lines).toEqual(["gamma", "beta", longLine]);
  });

  it("preserves multibyte UTF-8 across chunk boundaries", async () => {
    const firstLine = `${"a".repeat(1100)}🌊`;
    const secondLine = `${"b".repeat(1100)}✅`;
    fs.writeFileSync(transcriptPath, `${firstLine}\n${secondLine}\n`, "utf-8");

    const lines = await collect(
      streamSessionTranscriptLinesReverse(transcriptPath, {
        chunkBytes: 1024,
      }),
    );

    expect(lines).toEqual([secondLine, firstLine]);
  });

  it("honours an abort signal between reverse lines", async () => {
    fs.writeFileSync(transcriptPath, "one\ntwo\nthree\n", "utf-8");
    const controller = new AbortController();

    const out: string[] = [];
    for await (const line of streamSessionTranscriptLinesReverse(transcriptPath, {
      signal: controller.signal,
    })) {
      out.push(line);
      if (line === "three") {
        controller.abort();
      }
    }

    expect(out).toEqual(["three"]);
  });
});
