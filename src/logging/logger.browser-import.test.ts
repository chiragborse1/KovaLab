import { afterEach, describe, expect, it, vi } from "vitest";
import { importFreshModule } from "../../test/helpers/import-fresh.js";

type LoggerModule = typeof import("./logger.js");

const originalGetBuiltinModule = (
  process as NodeJS.Process & { getBuiltinModule?: (id: string) => unknown }
).getBuiltinModule;

async function importBrowserSafeLogger(params?: {
  resolvePreferredKovaTmpDir?: ReturnType<typeof vi.fn>;
}): Promise<{
  module: LoggerModule;
  resolvePreferredKovaTmpDir: ReturnType<typeof vi.fn>;
}> {
  const resolvePreferredKovaTmpDir =
    params?.resolvePreferredKovaTmpDir ??
    vi.fn(() => {
      throw new Error("resolvePreferredKovaTmpDir should not run during browser-safe import");
    });

  vi.doMock("../infra/tmp-kova-dir.js", async () => {
    const actual = await vi.importActual<typeof import("../infra/tmp-kova-dir.js")>(
      "../infra/tmp-kova-dir.js",
    );
    return {
      ...actual,
      resolvePreferredKovaTmpDir,
    };
  });

  Object.defineProperty(process, "getBuiltinModule", {
    configurable: true,
    value: undefined,
  });

  const module = await importFreshModule<LoggerModule>(
    import.meta.url,
    "./logger.js?scope=browser-safe",
  );
  return { module, resolvePreferredKovaTmpDir };
}

describe("logging/logger browser-safe import", () => {
  afterEach(() => {
    vi.doUnmock("../infra/tmp-kova-dir.js");
    Object.defineProperty(process, "getBuiltinModule", {
      configurable: true,
      value: originalGetBuiltinModule,
    });
  });

  it("does not resolve the preferred temp dir at import time when node fs is unavailable", async () => {
    const { module, resolvePreferredKovaTmpDir } = await importBrowserSafeLogger();

    expect(resolvePreferredKovaTmpDir).not.toHaveBeenCalled();
    expect(module.DEFAULT_LOG_DIR).toBe("/tmp/kova");
    expect(module.DEFAULT_LOG_FILE).toBe("/tmp/kova/kova.log");
  });

  it("disables file logging when imported in a browser-like environment", async () => {
    const { module, resolvePreferredKovaTmpDir } = await importBrowserSafeLogger();

    expect(module.getResolvedLoggerSettings()).toMatchObject({
      level: "silent",
      file: "/tmp/kova/kova.log",
    });
    expect(module.isFileLogLevelEnabled("info")).toBe(false);
    expect(() => module.getLogger().info("browser-safe")).not.toThrow();
    expect(resolvePreferredKovaTmpDir).not.toHaveBeenCalled();
  });
});
