import { describe, expect, it } from "vitest";
import { buildPlatformRuntimeLogHints, buildPlatformServiceStartHints } from "./runtime-hints.js";

describe("buildPlatformRuntimeLogHints", () => {
  it("renders launchd log hints on darwin", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "darwin",
        env: {
          OPENCLAW_STATE_DIR: "/tmp/openclaw-state",
          OPENCLAW_LOG_PREFIX: "gateway",
        },
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "Launchd stdout (if installed): /tmp/openclaw-state/logs/gateway.log",
      "Launchd stderr (if installed): /tmp/openclaw-state/logs/gateway.err.log",
      "Restart attempts: /tmp/openclaw-state/logs/gateway-restart.log",
    ]);
  });

  it("renders systemd and windows hints by platform", () => {
    expect(
      buildPlatformRuntimeLogHints({
        platform: "linux",
        env: {
          OPENCLAW_STATE_DIR: "/tmp/openclaw-state",
        },
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "Logs: journalctl --user -u kova-gateway.service -n 200 --no-pager",
      "Restart attempts: /tmp/openclaw-state/logs/gateway-restart.log",
    ]);
    expect(
      buildPlatformRuntimeLogHints({
        platform: "win32",
        env: {
          OPENCLAW_STATE_DIR: "/tmp/openclaw-state",
        },
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      'Logs: schtasks /Query /TN "Kova Gateway" /V /FO LIST',
      "Restart attempts: /tmp/openclaw-state/logs/gateway-restart.log",
    ]);
  });
});

describe("buildPlatformServiceStartHints", () => {
  it("builds platform-specific service start hints", () => {
    expect(
      buildPlatformServiceStartHints({
        platform: "darwin",
        installCommand: "openclaw gateway install",
        startCommand: "openclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.openclaw.gateway.plist",
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "openclaw gateway install",
      "openclaw gateway",
      "launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.openclaw.gateway.plist",
    ]);
    expect(
      buildPlatformServiceStartHints({
        platform: "linux",
        installCommand: "openclaw gateway install",
        startCommand: "openclaw gateway",
        launchAgentPlistPath: "~/Library/LaunchAgents/com.openclaw.gateway.plist",
        systemdServiceName: "kova-gateway",
        windowsTaskName: "Kova Gateway",
      }),
    ).toEqual([
      "openclaw gateway install",
      "openclaw gateway",
      "systemctl --user start kova-gateway.service",
    ]);
  });
});
