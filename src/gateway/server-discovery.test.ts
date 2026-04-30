import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getTailnetHostname = vi.hoisted(() => vi.fn());

vi.mock("../infra/tailscale.js", () => ({ getTailnetHostname }));

import { formatBonjourInstanceName, resolveTailnetDnsHint } from "./server-discovery.js";

describe("formatBonjourInstanceName", () => {
  test("defaults to Kova branding and preserves explicit branded names", () => {
    expect(formatBonjourInstanceName("")).toBe("Kova");
    expect(formatBonjourInstanceName("Mac Studio")).toBe("Mac Studio (Kova)");
    expect(formatBonjourInstanceName("Lab Mac (Kova)")).toBe("Lab Mac (Kova)");
    expect(formatBonjourInstanceName("Lab Mac (OpenClaw)")).toBe("Lab Mac (OpenClaw)");
  });
});

describe("resolveTailnetDnsHint", () => {
  const prevTailnetDns = { value: undefined as string | undefined };

  beforeEach(() => {
    prevTailnetDns.value = process.env.OPENCLAW_TAILNET_DNS;
    delete process.env.OPENCLAW_TAILNET_DNS;
    getTailnetHostname.mockClear();
  });

  afterEach(() => {
    if (prevTailnetDns.value === undefined) {
      delete process.env.OPENCLAW_TAILNET_DNS;
    } else {
      process.env.OPENCLAW_TAILNET_DNS = prevTailnetDns.value;
    }
  });

  test("returns env hint when disabled", async () => {
    process.env.OPENCLAW_TAILNET_DNS = "studio.tailnet.ts.net.";
    const value = await resolveTailnetDnsHint({ enabled: false });
    expect(value).toBe("studio.tailnet.ts.net");
    expect(getTailnetHostname).not.toHaveBeenCalled();
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
