import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordMemoryWatchEventPath, settleMemoryWatchEventPaths } from "./watch-settle.js";

describe("memory watch settle queue", () => {
  let tempDir = "";

  afterEach(async () => {
    vi.useRealTimers();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("settles immediately when the current file snapshot matches event stats", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-watch-settle-"));
    const filePath = path.join(tempDir, "MEMORY.md");
    await fs.writeFile(filePath, "hello");
    const stats = await fs.stat(filePath);
    const queue = new Map();

    recordMemoryWatchEventPath(queue, filePath, stats);

    await expect(settleMemoryWatchEventPaths(queue)).resolves.toBe(true);
    expect(queue.size).toBe(0);
  });

  it("requeues paths that are still changing after debounce", async () => {
    vi.useFakeTimers();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kova-watch-settle-"));
    const filePath = path.join(tempDir, "MEMORY.md");
    await fs.writeFile(filePath, "hello");
    const stats = await fs.stat(filePath);
    const queue = new Map();

    recordMemoryWatchEventPath(queue, filePath, stats);
    await fs.writeFile(filePath, "hello world");

    await expect(settleMemoryWatchEventPaths(queue)).resolves.toBe(false);
    expect(queue.size).toBe(1);
  });
});
