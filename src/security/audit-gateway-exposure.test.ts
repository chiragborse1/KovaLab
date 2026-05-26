import { describe, expect, it } from "vitest";
import type { KovaConfig } from "../config/config.js";
import { collectGatewayConfigFindings } from "./audit-gateway-config.js";

function hasFinding(
  checkId: string,
  severity: "warn" | "critical",
  findings: ReturnType<typeof collectGatewayConfigFindings>,
) {
  return findings.some((finding) => finding.checkId === checkId && finding.severity === severity);
}

describe("security audit gateway exposure findings", () => {
  it("warns on insecure or dangerous flags", () => {
    const cases = [
      {
        name: "generic insecure debug flags",
        cfg: {
          hooks: {
            gmail: { allowUnsafeExternalContent: true },
            mappings: [{ allowUnsafeExternalContent: true }],
          },
          tools: {
            exec: {
              applyPatch: {
                workspaceOnly: false,
              },
            },
          },
        } satisfies KovaConfig,
        expectedDangerousDetails: [
          "hooks.gmail.allowUnsafeExternalContent=true",
          "hooks.mappings[0].allowUnsafeExternalContent=true",
          "tools.exec.applyPatch.workspaceOnly=false",
        ],
      },
    ] as const;

    for (const testCase of cases) {
      const findings = collectGatewayConfigFindings(testCase.cfg, testCase.cfg, {});
      if ("expectedFinding" in testCase) {
        expect(findings, testCase.name).toEqual(
          expect.arrayContaining([expect.objectContaining(testCase.expectedFinding)]),
        );
      }
      const finding = findings.find(
        (entry) => entry.checkId === "config.insecure_or_dangerous_flags",
      );
      expect(finding, testCase.name).toBeTruthy();
      expect(finding?.severity, testCase.name).toBe("warn");
      for (const snippet of testCase.expectedDangerousDetails) {
        expect(finding?.detail, `${testCase.name}:${snippet}`).toContain(snippet);
      }
    }
  });

  it.each([
    {
      name: "loopback gateway",
      cfg: {
        gateway: {
          bind: "loopback",
          allowRealIpFallback: true,
          trustedProxies: ["127.0.0.1"],
          auth: {
            mode: "token",
            token: "very-long-token-1234567890",
          },
        },
      } satisfies KovaConfig,
      expectedSeverity: "warn" as const,
    },
    {
      name: "lan gateway",
      cfg: {
        gateway: {
          bind: "lan",
          allowRealIpFallback: true,
          trustedProxies: ["10.0.0.1"],
          auth: {
            mode: "token",
            token: "very-long-token-1234567890",
          },
        },
      } satisfies KovaConfig,
      expectedSeverity: "critical" as const,
    },
    {
      name: "loopback trusted-proxy with loopback-only proxies",
      cfg: {
        gateway: {
          bind: "loopback",
          allowRealIpFallback: true,
          trustedProxies: ["127.0.0.1"],
          auth: {
            mode: "trusted-proxy",
            trustedProxy: {
              userHeader: "x-forwarded-user",
            },
          },
        },
      } satisfies KovaConfig,
      expectedSeverity: "warn" as const,
    },
    {
      name: "loopback trusted-proxy with non-loopback proxy range",
      cfg: {
        gateway: {
          bind: "loopback",
          allowRealIpFallback: true,
          trustedProxies: ["127.0.0.1", "10.0.0.0/8"],
          auth: {
            mode: "trusted-proxy",
            trustedProxy: {
              userHeader: "x-forwarded-user",
            },
          },
        },
      } satisfies KovaConfig,
      expectedSeverity: "critical" as const,
    },
    {
      name: "loopback trusted-proxy with 127.0.0.2",
      cfg: {
        gateway: {
          bind: "loopback",
          allowRealIpFallback: true,
          trustedProxies: ["127.0.0.2"],
          auth: {
            mode: "trusted-proxy",
            trustedProxy: {
              userHeader: "x-forwarded-user",
            },
          },
        },
      } satisfies KovaConfig,
      expectedSeverity: "critical" as const,
    },
    {
      name: "loopback trusted-proxy with 127.0.0.0/8 range",
      cfg: {
        gateway: {
          bind: "loopback",
          allowRealIpFallback: true,
          trustedProxies: ["127.0.0.0/8"],
          auth: {
            mode: "trusted-proxy",
            trustedProxy: {
              userHeader: "x-forwarded-user",
            },
          },
        },
      } satisfies KovaConfig,
      expectedSeverity: "critical" as const,
    },
  ])("scores X-Real-IP fallback risk by gateway exposure: $name", ({ cfg, expectedSeverity }) => {
    expect(
      hasFinding(
        "gateway.real_ip_fallback_enabled",
        expectedSeverity,
        collectGatewayConfigFindings(cfg, cfg, {}),
      ),
    ).toBe(true);
  });

  it.each([
    {
      name: "loopback gateway with full mDNS",
      cfg: {
        gateway: {
          bind: "loopback",
          auth: {
            mode: "token",
            token: "very-long-token-1234567890",
          },
        },
        discovery: {
          mdns: { mode: "full" },
        },
      } satisfies KovaConfig,
      expectedSeverity: "warn" as const,
    },
    {
      name: "lan gateway with full mDNS",
      cfg: {
        gateway: {
          bind: "lan",
          auth: {
            mode: "token",
            token: "very-long-token-1234567890",
          },
        },
        discovery: {
          mdns: { mode: "full" },
        },
      } satisfies KovaConfig,
      expectedSeverity: "critical" as const,
    },
  ])("scores mDNS full mode risk by gateway bind mode: $name", ({ cfg, expectedSeverity }) => {
    expect(
      hasFinding(
        "discovery.mdns_full_mode",
        expectedSeverity,
        collectGatewayConfigFindings(cfg, cfg, {}),
      ),
    ).toBe(true);
  });

  it("evaluates trusted-proxy auth guardrails", () => {
    const cases: Array<{
      name: string;
      cfg: KovaConfig;
      expectedCheckId: string;
      expectedSeverity: "warn" | "critical";
      suppressesGenericSharedSecretFindings?: boolean;
    }> = [
      {
        name: "trusted-proxy base mode",
        cfg: {
          gateway: {
            bind: "lan",
            trustedProxies: ["10.0.0.1"],
            auth: {
              mode: "trusted-proxy",
              trustedProxy: { userHeader: "x-forwarded-user" },
            },
          },
        },
        expectedCheckId: "gateway.trusted_proxy_auth",
        expectedSeverity: "critical",
        suppressesGenericSharedSecretFindings: true,
      },
      {
        name: "missing trusted proxies",
        cfg: {
          gateway: {
            bind: "lan",
            trustedProxies: [],
            auth: {
              mode: "trusted-proxy",
              trustedProxy: { userHeader: "x-forwarded-user" },
            },
          },
        },
        expectedCheckId: "gateway.trusted_proxy_no_proxies",
        expectedSeverity: "critical",
      },
      {
        name: "missing user header",
        cfg: {
          gateway: {
            bind: "lan",
            trustedProxies: ["10.0.0.1"],
            auth: {
              mode: "trusted-proxy",
              trustedProxy: {} as never,
            },
          },
        },
        expectedCheckId: "gateway.trusted_proxy_no_user_header",
        expectedSeverity: "critical",
      },
      {
        name: "missing user allowlist",
        cfg: {
          gateway: {
            bind: "lan",
            trustedProxies: ["10.0.0.1"],
            auth: {
              mode: "trusted-proxy",
              trustedProxy: {
                userHeader: "x-forwarded-user",
                allowUsers: [],
              },
            },
          },
        },
        expectedCheckId: "gateway.trusted_proxy_no_allowlist",
        expectedSeverity: "warn",
      },
    ];

    for (const testCase of cases) {
      const findings = collectGatewayConfigFindings(testCase.cfg, testCase.cfg, {});
      expect(
        hasFinding(testCase.expectedCheckId, testCase.expectedSeverity, findings),
        testCase.name,
      ).toBe(true);
      if (testCase.suppressesGenericSharedSecretFindings) {
        expect(findings.some((finding) => finding.checkId === "gateway.bind_no_auth")).toBe(false);
        expect(findings.some((finding) => finding.checkId === "gateway.auth_no_rate_limit")).toBe(
          false,
        );
      }
    }
  });
});
