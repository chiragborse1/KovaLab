import { describe, expect, it, vi } from "vitest";
import { createCliProgress } from "./progress.js";

describe("cli progress", () => {
  it("logs progress when non-tty and fallback=log", () => {
    const writes: string[] = [];
    const stream = {
      isTTY: false,
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
      }),
    } as unknown as NodeJS.WriteStream;

    const progress = createCliProgress({
      label: "Indexing memory...",
      total: 10,
      stream,
      fallback: "log",
    });
    progress.setPercent(50);
    progress.done();

    const output = writes.join("");
    expect(output).toContain("Indexing memory... 0%");
    expect(output).toContain("Indexing memory... 50%");
  });

  it("does not log without a tty when fallback is none", () => {
    const write = vi.fn();
    const stream = {
      isTTY: false,
      write,
    } as unknown as NodeJS.WriteStream;

    const progress = createCliProgress({
      label: "Nope",
      total: 2,
      stream,
      fallback: "none",
    });
    progress.setPercent(50);
    progress.done();

    expect(write).not.toHaveBeenCalled();
  });

  it("emits sanitized OSC progress directly without loading an external helper", () => {
    const previousWtSession = process.env.WT_SESSION;
    process.env.WT_SESSION = "test-session";
    const writes: string[] = [];
    const stream = {
      isTTY: true,
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
      }),
    } as unknown as NodeJS.WriteStream;

    try {
      const progress = createCliProgress({
        label: "Load] channels\x1b",
        total: 2,
        stream,
        fallback: "none",
      });
      progress.setPercent(50);
      progress.done();
    } finally {
      if (previousWtSession === undefined) {
        delete process.env.WT_SESSION;
      } else {
        process.env.WT_SESSION = previousWtSession;
      }
    }
    const output = writes.join("");
    expect(output).toContain("\x1b]9;4;");
    expect(output).toContain("Load channels");
    expect(output).not.toContain("Load] channels");
  });
});
