import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGatewayControlUiRootState } from "./server-control-ui-root.js";

const controlUiAssets = vi.hoisted(() => ({
  ensureControlUiAssetsBuilt: vi.fn(),
  isPackageProvenControlUiRootSync: vi.fn(),
  resolveControlUiRootOverrideSync: vi.fn(),
  resolveControlUiRootSync: vi.fn(),
}));

vi.mock("../infra/control-ui-assets.js", () => controlUiAssets);

const runtime = {
  log: vi.fn(),
} as never;

describe("resolveGatewayControlUiRootState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not auto-build missing web assets unless explicitly requested", async () => {
    controlUiAssets.resolveControlUiRootSync.mockReturnValue(null);

    const result = await resolveGatewayControlUiRootState({
      controlUiEnabled: true,
      gatewayRuntime: runtime,
      log: { warn: vi.fn() },
    });

    expect(result).toEqual({ kind: "missing" });
    expect(controlUiAssets.ensureControlUiAssetsBuilt).not.toHaveBeenCalled();
  });

  it("auto-builds missing web assets for explicit Control UI opt-in", async () => {
    controlUiAssets.resolveControlUiRootSync
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("/tmp/ui");
    controlUiAssets.ensureControlUiAssetsBuilt.mockResolvedValue({ ok: true, built: true });
    controlUiAssets.isPackageProvenControlUiRootSync.mockReturnValue(false);

    const result = await resolveGatewayControlUiRootState({
      controlUiEnabled: true,
      autoBuildAssets: true,
      gatewayRuntime: runtime,
      log: { warn: vi.fn() },
    });

    expect(result).toEqual({ kind: "resolved", path: "/tmp/ui" });
    expect(controlUiAssets.ensureControlUiAssetsBuilt).toHaveBeenCalled();
  });
});
