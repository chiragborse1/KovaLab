import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getTailnetHostname = vi.hoisted(() => vi.fn());

vi.mock("../infra/tailscale.js", () => ({ getTailnetHostname }));

import {
  formatBonjourInstanceName,
  resolveBonjourCliPath,
  resolveTailnetDnsHint,
} from "./server-discovery.js";

describe("formatBonjourInstanceName", () => {
  test("defaults to Kova branding and preserves explicit branded names", () => {
    expect(formatBonjourInstanceName("")).toBe("Kova");
    expect(formatBonjourInstanceName("Mac Studio")).toBe("Mac Studio (Kova)");
    expect(formatBonjourInstanceName("Lab Mac (Kova)")).toBe("Lab Mac (Kova)");
    expect(formatBonjourInstanceName("Lab Mac (Kova)")).toBe("Lab Mac (Kova)");
  });
});

describe("resolveTailnetDnsHint", () => {
  const prevEnv = {
    kovaTailnetDns: undefined as string | undefined,
    legacyTailnetDns: undefined as string | undefined,
    compat: undefined as string | undefined,
  };

  beforeEach(() => {
    prevEnv.kovaTailnetDns = process.env.KOVA_TAILNET_DNS;
    prevEnv.legacyTailnetDns = process.env.KOVA_TAILNET_DNS;
    prevEnv.compat = process.env.KOVA_COMPAT;
    delete process.env.KOVA_TAILNET_DNS;
    delete process.env.KOVA_TAILNET_DNS;
    delete process.env.KOVA_COMPAT;
    getTailnetHostname.mockClear();
  });

  afterEach(() => {
    if (prevEnv.kovaTailnetDns === undefined) {
      delete process.env.KOVA_TAILNET_DNS;
    } else {
      process.env.KOVA_TAILNET_DNS = prevEnv.kovaTailnetDns;
    }
    if (prevEnv.legacyTailnetDns === undefined) {
      delete process.env.KOVA_TAILNET_DNS;
    } else {
      process.env.KOVA_TAILNET_DNS = prevEnv.legacyTailnetDns;
    }
    if (prevEnv.compat === undefined) {
      delete process.env.KOVA_COMPAT;
    } else {
      process.env.KOVA_COMPAT = prevEnv.compat;
    }
  });

  test("returns env hint when disabled", async () => {
    process.env.KOVA_TAILNET_DNS = "studio.tailnet.ts.net.";
    const value = await resolveTailnetDnsHint({ enabled: false });
    expect(value).toBe("studio.tailnet.ts.net");
    expect(getTailnetHostname).not.toHaveBeenCalled();
  });

  test("uses Kova env hint when compatibility is explicit", async () => {
    process.env.KOVA_TAILNET_DNS = "studio.tailnet.ts.net.";
    process.env.KOVA_COMPAT = "1";
    await expect(resolveTailnetDnsHint({ enabled: false })).resolves.toBe("studio.tailnet.ts.net");
  });

  test("skips tailscale lookup when disabled", async () => {
    const value = await resolveTailnetDnsHint({ enabled: false });
    expect(value).toBeUndefined();
    expect(getTailnetHostname).not.toHaveBeenCalled();
  });

  test("uses tailscale lookup when enabled", async () => {
    getTailnetHostname.mockResolvedValue("host.tailnet.ts.net");
    const value = await resolveTailnetDnsHint({ enabled: true });
    expect(value).toBe("host.tailnet.ts.net");
    expect(getTailnetHostname).toHaveBeenCalledTimes(1);
  });
});

describe("resolveBonjourCliPath", () => {
  const statSync = (candidate: string) =>
    ({
      isFile: () => candidate === "/bin/kova",
    }) as import("node:fs").Stats;

  test("prefers Kova CLI path overrides", () => {
    expect(
      resolveBonjourCliPath({ env: { KOVA_CLI_PATH: "/bin/kova" } as NodeJS.ProcessEnv, statSync }),
    ).toBe("/bin/kova");
  });

  test("uses Kova CLI path overrides when compatibility is explicit", () => {
    const env = { KOVA_CLI_PATH: "/bin/kova" } as NodeJS.ProcessEnv;
    expect(
      resolveBonjourCliPath({
        env: { ...env, KOVA_COMPAT: "1" } as NodeJS.ProcessEnv,
        statSync,
        execPath: "/missing/node",
        argv: [],
        cwd: "/missing",
      }),
    ).toBe("/bin/kova");
  });
});
