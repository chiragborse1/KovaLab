import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          KOVA_STATE_DIR: "/tmp/kova-state",
          KOVA_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/kova-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/kova-state/logs/gateway.err.log",
      "Restart attempts: /tmp/kova-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          KOVA_STATE_DIR: "/tmp/kova-state",
        },
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u kova-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/kova-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          KOVA_STATE_DIR: "/tmp/kova-state",
        },
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "Kova Gateway" /V /FO LIST',
      "Restart attempts: /tmp/kova-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "kova gateway install",
        startCommand: "kova gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.kova.gateway.plist",
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "kova gateway install",
      "kova gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.kova.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "kova gateway install",
        startCommand: "kova gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.kova.gateway.plist",
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "kova gateway install",
      "kova gateway",
      "systemctl --user start kova-gateway.service",
    ]);
  });
});
