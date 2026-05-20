import { afterAll, describe, expect, it } from "vitest";
import {
  type GatewayInstance,
  postJson,
  spawnGatewayInstance,
  stopGatewayInstance,
} from "./helpers/gateway-e2e-harness.js";

const E2E_TIMEOUT_MS = 360_000;

describe("gateway multi-instance e2e", () => {
  const instances: GatewayInstance[] = [];

  const trackInstance = (inst: GatewayInstance) => {
    instances.push(inst);
    return inst;
  };

  const untrackInstance = (inst: GatewayInstance) => {
    const index = instances.indexOf(inst);
    if (index >= 0) {
      instances.splice(index, 1);
    }
  };

  const stopTrackedInstances = async (trackedInstances: GatewayInstance[]) => {
    for (const inst of trackedInstances.splice(0).toReversed()) {
      untrackInstance(inst);
      await stopGatewayInstance(inst);
    }
  };

  afterAll(async () => {
    await stopTrackedInstances(instances);
  });

  it("spins up two gateways and exercises HTTP hooks", { timeout: E2E_TIMEOUT_MS }, async () => {
    const testInstances: GatewayInstance[] = [];

    try {
      const gwA = trackInstance(await spawnGatewayInstance("a"));
      testInstances.push(gwA);
      const gwB = trackInstance(await spawnGatewayInstance("b"));
      testInstances.push(gwB);

      const [hookResA, hookResB] = await Promise.all([
        postJson(
          `http://127.0.0.1:${gwA.port}/hooks/wake`,
          {
            text: "wake a",
            mode: "now",
          },
          { "x-kova-token": gwA.hookToken },
        ),
        postJson(
          `http://127.0.0.1:${gwB.port}/hooks/wake`,
          {
            text: "wake b",
            mode: "now",
          },
          { "x-kova-token": gwB.hookToken },
        ),
      ]);
      expect(hookResA.status).toBe(200);
      expect((hookResA.json as { ok?: boolean } | undefined)?.ok).toBe(true);
      expect(hookResB.status).toBe(200);
      expect((hookResB.json as { ok?: boolean } | undefined)?.ok).toBe(true);
    } finally {
      await stopTrackedInstances(testInstances);
    }
  });
});
