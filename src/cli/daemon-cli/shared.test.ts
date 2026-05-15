import { describe, expect, it } from "vitest";
import { theme } from "../../terminal/theme.js";
import {
  filterContainerGenericHints,
  renderGatewayServiceStartHints,
  resolveDaemonContainerContext,
  resolveRuntimeStatusColor,
  safeDaemonEnv,
} from "./shared.js";

describe("resolveRuntimeStatusColor", () => {
  it("maps known runtime states to expected theme colors", () => {
    expect(resolveRuntimeStatusColor("running")).toBe(theme.success);
    expect(resolveRuntimeStatusColor("stopped")).toBe(theme.error);
    expect(resolveRuntimeStatusColor("unknown")).toBe(theme.muted);
  });

  it("falls back to warning color for unexpected states", () => {
    expect(resolveRuntimeStatusColor("degraded")).toBe(theme.warn);
    expect(resolveRuntimeStatusColor(undefined)).toBe(theme.muted);
  });
});

describe("renderGatewayServiceStartHints", () => {
  it("resolves daemon container context from either env key", () => {
    expect(
      resolveDaemonContainerContext({
        KOVA_CONTAINER: "kova-demo-container",
      } as NodeJS.ProcessEnv),
    ).toBe("kova-demo-container");
    expect(
      resolveDaemonContainerContext({
        KOVA_CONTAINER_HINT: "kova-demo-container",
      } as NodeJS.ProcessEnv),
    ).toBe("kova-demo-container");
  });

  it("prepends a single container restart hint when KOVA_CONTAINER is set", () => {
    expect(
      renderGatewayServiceStartHints({
        KOVA_CONTAINER: "kova-demo-container",
      } as NodeJS.ProcessEnv),
    ).toEqual(
      expect.arrayContaining([
        "Restart the container or the service that manages it for kova-demo-container.",
      ]),
    );
  });

  it("prepends a single container restart hint when KOVA_CONTAINER_HINT is set", () => {
    expect(
      renderGatewayServiceStartHints({
        KOVA_CONTAINER_HINT: "kova-demo-container",
      } as NodeJS.ProcessEnv),
    ).toEqual(
      expect.arrayContaining([
        "Restart the container or the service that manages it for kova-demo-container.",
      ]),
    );
  });
});

describe("filterContainerGenericHints", () => {
  it("drops the generic container foreground hint when KOVA_CONTAINER is set", () => {
    expect(
      filterContainerGenericHints(
        [
          "systemd user services are unavailable; install/enable systemd or run the gateway under your supervisor.",
          "If you're in a container, run the gateway in the foreground instead of `kova gateway`.",
        ],
        { KOVA_CONTAINER: "kova-demo-container" } as NodeJS.ProcessEnv,
      ),
    ).toEqual([]);
  });

  it("drops the generic container foreground hint when KOVA_CONTAINER_HINT is set", () => {
    expect(
      filterContainerGenericHints(
        [
          "systemd user services are unavailable; install/enable systemd or run the gateway under your supervisor.",
          "If you're in a container, run the gateway in the foreground instead of `kova gateway`.",
        ],
        { KOVA_CONTAINER_HINT: "kova-demo-container" } as NodeJS.ProcessEnv,
      ),
    ).toEqual([]);
  });
});

describe("safeDaemonEnv", () => {
  it("shows safe Kova env names", () => {
    expect(
      safeDaemonEnv({
        KOVA_GATEWAY_PORT: "18789",
        KOVA_STATE_DIR: "/tmp/kova",
      }),
    ).toEqual(["KOVA_STATE_DIR=/tmp/kova", "KOVA_GATEWAY_PORT=18789"]);
  });
});
