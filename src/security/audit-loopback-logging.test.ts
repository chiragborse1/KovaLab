import { describe, expect, it } from "vitest";
import type { KovaConfig } from "../config/config.js";
import { withEnvAsync } from "../test-utils/env.js";
import { collectGatewayConfigFindings, collectLoggingFindings } from "./audit.js";

function hasGatewayFinding(
  checkId: "gateway.trusted_proxies_missing" | "gateway.loopback_no_auth",
  severity: "warn" | "critical",
  findings: ReturnType<typeof collectGatewayConfigFindings>,
) {
  return findings.some((finding) => finding.checkId === checkId && finding.severity === severity);
}

function hasLoggingFinding(
  checkId: "logging.redact_off",
  severity: "warn",
  findings: ReturnType<typeof collectLoggingFindings>,
) {
  return findings.some((finding) => finding.checkId === checkId && finding.severity === severity);
}

describe("security audit loopback and logging findings", () => {
  it("evaluates loopback gateway and logging exposure findings", async () => {
    await Promise.all([
      (async () => {
        const cfg: KovaConfig = {
          gateway: {
            bind: "loopback",
            auth: { mode: "trusted-proxy" },
          },
        };
        expect(
          hasGatewayFinding(
            "gateway.trusted_proxies_missing",
            "warn",
            collectGatewayConfigFindings(cfg, cfg, process.env),
          ),
        ).toBe(true);
      })(),
      (async () => {
        const cfg: KovaConfig = {
          gateway: {
            bind: "loopback",
            auth: { mode: "token", token: "test-token" },
          },
        };
        expect(
          hasGatewayFinding(
            "gateway.trusted_proxies_missing",
            "warn",
            collectGatewayConfigFindings(cfg, cfg, process.env),
          ),
        ).toBe(false);
      })(),
      withEnvAsync(
        {
          KOVA_GATEWAY_TOKEN: undefined,
          KOVA_GATEWAY_PASSWORD: undefined,
        },
        async () => {
          const cfg: KovaConfig = {
            gateway: {
              bind: "loopback",
              auth: {},
            },
          };
          expect(
            hasGatewayFinding(
              "gateway.loopback_no_auth",
              "critical",
              collectGatewayConfigFindings(cfg, cfg, process.env),
            ),
          ).toBe(true);
        },
      ),
      (async () => {
        const cfg: KovaConfig = {
          logging: { redactSensitive: "off" },
        };
        expect(hasLoggingFinding("logging.redact_off", "warn", collectLoggingFindings(cfg))).toBe(
          true,
        );
      })(),
    ]);
  });
});
