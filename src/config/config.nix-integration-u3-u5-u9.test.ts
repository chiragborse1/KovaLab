import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GATEWAY_PORT,
  resolveConfigPathCandidate,
  resolveGatewayPort,
  resolveIsNixMode,
  resolveStateDir,
} from "./config.js";
import { withTempHome } from "./test-helpers.js";

vi.unmock("../version.js");

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  // Hermetic env: don't inherit process.env because other tests may mutate it.
  return { ...overrides };
}

describe("Nix integration (U3, U5, U9)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("U3: isNixMode env var detection", () => {
    it("isNixMode is false when KOVA_NIX_MODE is not set", () => {
      expect(resolveIsNixMode(envWith({ KOVA_NIX_MODE: undefined }))).toBe(false);
    });

    it("isNixMode is false when KOVA_NIX_MODE is empty", () => {
      expect(resolveIsNixMode(envWith({ KOVA_NIX_MODE: "" }))).toBe(false);
    });

    it("isNixMode is false when KOVA_NIX_MODE is not '1'", () => {
      expect(resolveIsNixMode(envWith({ KOVA_NIX_MODE: "true" }))).toBe(false);
    });

    it("isNixMode is true when KOVA_NIX_MODE=1", () => {
      expect(resolveIsNixMode(envWith({ KOVA_NIX_MODE: "1" }))).toBe(true);
    });

    it("requires explicit compatibility mode for legacy nix env", () => {
      expect(resolveIsNixMode(envWith({ OPENCLAW_NIX_MODE: "1" }))).toBe(false);
      expect(
        resolveIsNixMode(envWith({ KOVA_ALLOW_OPENCLAW_COMPAT: "1", OPENCLAW_NIX_MODE: "1" })),
      ).toBe(true);
    });
  });

  describe("U5: CONFIG_PATH and STATE_DIR env var overrides", () => {
    it("STATE_DIR defaults to ~/.kova when env not set", () => {
      const home = path.join(path.sep, "custom", "nix-home");
      expect(
        resolveStateDir(
          envWith({
            KOVA_HOME: home,
            KOVA_STATE_DIR: undefined,
            OPENCLAW_STATE_DIR: undefined,
          }),
          () => home,
        ),
      ).toBe(path.join(path.resolve(home), ".kova"));
    });

    it("STATE_DIR respects KOVA_STATE_DIR override", () => {
      expect(
        resolveStateDir(
          envWith({
            KOVA_STATE_DIR: "/custom/kova-state/dir",
            OPENCLAW_STATE_DIR: "/custom/state/dir",
          }),
        ),
      ).toBe(path.resolve("/custom/kova-state/dir"));
    });

    it("STATE_DIR ignores OPENCLAW_STATE_DIR override when KOVA_STATE_DIR is unset", () => {
      const home = path.join(path.sep, "custom", "home");
      expect(
        resolveStateDir(
          envWith({ KOVA_STATE_DIR: undefined, OPENCLAW_STATE_DIR: "/custom/state/dir" }),
          () => home,
        ),
      ).toBe(path.join(path.resolve(home), ".kova"));
    });

    it("STATE_DIR respects KOVA_HOME when state override is unset", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveStateDir(envWith({ KOVA_HOME: customHome, OPENCLAW_STATE_DIR: undefined })),
      ).toBe(path.join(path.resolve(customHome), ".kova"));
    });

    it("CONFIG_PATH defaults to KOVA_HOME/.kova/kova.json", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveConfigPathCandidate(
          envWith({
            KOVA_HOME: customHome,
            OPENCLAW_CONFIG_PATH: undefined,
            OPENCLAW_STATE_DIR: undefined,
          }),
        ),
      ).toBe(path.join(path.resolve(customHome), ".kova", "kova.json"));
    });

    it("CONFIG_PATH defaults to ~/.kova/kova.json when env not set", () => {
      const home = path.join(path.sep, "custom", "nix-home");
      expect(
        resolveConfigPathCandidate(
          envWith({
            KOVA_HOME: home,
            OPENCLAW_CONFIG_PATH: undefined,
            OPENCLAW_STATE_DIR: undefined,
          }),
          () => home,
        ),
      ).toBe(path.join(path.resolve(home), ".kova", "kova.json"));
    });

    it("CONFIG_PATH respects KOVA_CONFIG_PATH override", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({
            KOVA_CONFIG_PATH: "/nix/store/abc/kova.json",
            OPENCLAW_CONFIG_PATH: "/nix/store/abc/openclaw.json",
          }),
        ),
      ).toBe(path.resolve("/nix/store/abc/kova.json"));
    });

    it("CONFIG_PATH expands ~ in KOVA_CONFIG_PATH override", async () => {
      await withTempHome(async (home) => {
        expect(
          resolveConfigPathCandidate(
            envWith({ KOVA_HOME: home, KOVA_CONFIG_PATH: "~/.kova/custom.json" }),
            () => home,
          ),
        ).toBe(path.join(home, ".kova", "custom.json"));
      });
    });

    it("CONFIG_PATH uses STATE_DIR when only state dir is overridden", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ KOVA_STATE_DIR: "/custom/state", OPENCLAW_TEST_FAST: "1" }),
          () => path.join(path.sep, "tmp", "openclaw-config-home"),
        ),
      ).toBe(path.join(path.resolve("/custom/state"), "kova.json"));
    });
  });

  describe("U6: gateway port resolution", () => {
    it("uses default when env and config are unset", () => {
      expect(resolveGatewayPort({}, envWith({ OPENCLAW_GATEWAY_PORT: undefined }))).toBe(
        DEFAULT_GATEWAY_PORT,
      );
    });

    it("prefers KOVA_GATEWAY_PORT over config", () => {
      expect(
        resolveGatewayPort({ gateway: { port: 19002 } }, envWith({ KOVA_GATEWAY_PORT: "19001" })),
      ).toBe(19001);
    });

    it("falls back to config when env is invalid", () => {
      expect(
        resolveGatewayPort({ gateway: { port: 19003 } }, envWith({ KOVA_GATEWAY_PORT: "nope" })),
      ).toBe(19003);
    });
  });
});
