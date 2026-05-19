import { describe, expect, it, vi } from "vitest";
import { tryHandleRootHelpFastPath } from "./entry.js";

const outputPrecomputedRootHelpTextMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("./cli/root-help-metadata.js", () => ({
  outputPrecomputedRootHelpText: outputPrecomputedRootHelpTextMock,
}));

describe("entry root help fast path", () => {
  it("prefers precomputed root help text when available", async () => {
    outputPrecomputedRootHelpTextMock.mockReturnValueOnce(true);

    const handled = await tryHandleRootHelpFastPath(["node", "kova", "--help"], {
      env: {},
      loadRootHelpRenderOptionsForConfigSensitivePlugins: async () => null,
    });

    expect(handled).toBe(true);
    expect(outputPrecomputedRootHelpTextMock).toHaveBeenCalledTimes(1);
  });

  it("renders root help without importing the full program", async () => {
    const outputRootHelpMock = vi.fn();

    const handled = await tryHandleRootHelpFastPath(["node", "kova", "--help"], {
      outputRootHelp: outputRootHelpMock,
      loadRootHelpRenderOptionsForConfigSensitivePlugins: async () => null,
      env: {},
    });

    expect(handled).toBe(true);
    expect(outputRootHelpMock).toHaveBeenCalledTimes(1);
  });

  it("renders live root help when plugin config changes command descriptors", async () => {
    const outputPrecomputedRootHelpTextMock = vi.fn(() => true);
    const outputRootHelpMock = vi.fn();
    const liveOptions = {
      config: {
        plugins: {
          slots: {
            memory: "memory-lancedb",
          },
        },
      },
      env: {},
    };

    const handled = await tryHandleRootHelpFastPath(["node", "kova", "--help"], {
      env: {},
      outputPrecomputedRootHelpText: outputPrecomputedRootHelpTextMock,
      outputRootHelp: outputRootHelpMock,
      loadRootHelpRenderOptionsForConfigSensitivePlugins: async () => liveOptions,
    });

    expect(handled).toBe(true);
    expect(outputPrecomputedRootHelpTextMock).not.toHaveBeenCalled();
    expect(outputRootHelpMock).toHaveBeenCalledWith(liveOptions);
  });

  it("ignores non-root help invocations", async () => {
    const outputRootHelpMock = vi.fn();

    const handled = await tryHandleRootHelpFastPath(["node", "kova", "status", "--help"], {
      outputRootHelp: outputRootHelpMock,
      loadRootHelpRenderOptionsForConfigSensitivePlugins: async () => null,
      env: {},
    });

    expect(handled).toBe(false);
    expect(outputRootHelpMock).not.toHaveBeenCalled();
  });

  it("skips the host help fast path when a container target is active", async () => {
    const outputRootHelpMock = vi.fn();

    const handled = await tryHandleRootHelpFastPath(
      ["node", "kova", "--container", "demo", "--help"],
      {
        outputRootHelp: outputRootHelpMock,
        loadRootHelpRenderOptionsForConfigSensitivePlugins: async () => null,
        env: {},
      },
    );

    expect(handled).toBe(false);
    expect(outputRootHelpMock).not.toHaveBeenCalled();
  });
});
