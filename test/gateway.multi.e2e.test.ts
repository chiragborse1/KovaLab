import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { GatewayClient } from "../src/gateway/client.js";
import { connectGatewayClient } from "../src/gateway/test-helpers.e2e.js";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../src/utils/message-channel.js";
import {
  type ChatEventPayload,
  type GatewayInstance,
  extractFirstTextBlock,
  postJson,
  spawnGatewayInstance,
  stopGatewayInstance,
  waitForChatFinalEvent,
} from "./helpers/gateway-e2e-harness.js";

const E2E_TIMEOUT_MS = 360_000;

describe("gateway multi-instance e2e", () => {
  const instances: GatewayInstance[] = [];
  const clients: GatewayClient[] = [];

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

  const trackClient = (client: GatewayClient) => {
    clients.push(client);
    return client;
  };

  const untrackClient = (client: GatewayClient) => {
    const index = clients.indexOf(client);
    if (index >= 0) {
      clients.splice(index, 1);
    }
  };

  const stopTrackedClients = async (trackedClients: GatewayClient[]) => {
    for (const client of trackedClients.splice(0).toReversed()) {
      untrackClient(client);
      await client.stopAndWait({ timeoutMs: 1_000 }).catch(() => client.stop());
    }
  };

  const stopTrackedInstances = async (trackedInstances: GatewayInstance[]) => {
    for (const inst of trackedInstances.splice(0).toReversed()) {
      untrackInstance(inst);
      await stopGatewayInstance(inst);
    }
  };

  const formatGatewayConnectTimeout = (inst: GatewayInstance) => {
    const stdout = inst.stdout.slice(-40).join("");
    const stderr = inst.stderr.slice(-40).join("");
    return [
      `gateway ${inst.name} connect timeout on port ${inst.port}`,
      "--- stdout tail ---",
      stdout.trim() || "(empty)",
      "--- stderr tail ---",
      stderr.trim() || "(empty)",
    ].join("\n");
  };

  afterAll(async () => {
    await stopTrackedClients(clients);
    await stopTrackedInstances(instances);
  });

  it(
    "spins up two gateways and exercises WS + HTTP hooks",
    { timeout: E2E_TIMEOUT_MS },
    async () => {
      const testInstances: GatewayInstance[] = [];
      const testClients: GatewayClient[] = [];

      try {
        const gwA = trackInstance(await spawnGatewayInstance("a"));
        testInstances.push(gwA);
        const clientA = trackClient(
          await connectGatewayClient({
            url: `ws://127.0.0.1:${gwA.port}`,
            token: gwA.gatewayToken,
            clientName: GATEWAY_CLIENT_NAMES.CLI,
            clientDisplayName: "multi-e2e-a",
            clientVersion: "1.0.0",
            platform: "test",
            mode: GATEWAY_CLIENT_MODES.CLI,
            deviceIdentity: null,
            timeoutMs: 120_000,
            timeoutMessage: () => formatGatewayConnectTimeout(gwA),
          }),
        );
        testClients.push(clientA);

        const gwB = trackInstance(await spawnGatewayInstance("b"));
        testInstances.push(gwB);
        const clientB = trackClient(
          await connectGatewayClient({
            url: `ws://127.0.0.1:${gwB.port}`,
            token: gwB.gatewayToken,
            clientName: GATEWAY_CLIENT_NAMES.CLI,
            clientDisplayName: "multi-e2e-b",
            clientVersion: "1.0.0",
            platform: "test",
            mode: GATEWAY_CLIENT_MODES.CLI,
            deviceIdentity: null,
            timeoutMs: 120_000,
            timeoutMessage: () => formatGatewayConnectTimeout(gwB),
          }),
        );
        testClients.push(clientB);

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
        await stopTrackedClients(testClients);
        await stopTrackedInstances(testInstances);
      }
    },
  );

  it(
    "delivers final chat event for telegram-shaped session keys",
    { timeout: E2E_TIMEOUT_MS },
    async () => {
      const testInstances: GatewayInstance[] = [];
      const testClients: GatewayClient[] = [];

      try {
        const gw = trackInstance(await spawnGatewayInstance("chat-telegram-fixture"));
        testInstances.push(gw);

        const chatEvents: ChatEventPayload[] = [];
        const chatClient = trackClient(
          await connectGatewayClient({
            url: `ws://127.0.0.1:${gw.port}`,
            token: gw.gatewayToken,
            clientName: GATEWAY_CLIENT_NAMES.CLI,
            clientDisplayName: "chat-e2e-cli",
            clientVersion: "1.0.0",
            platform: "test",
            mode: GATEWAY_CLIENT_MODES.CLI,
            timeoutMs: 120_000,
            onEvent: (evt) => {
              if (evt.event === "chat" && evt.payload && typeof evt.payload === "object") {
                chatEvents.push(evt.payload as ChatEventPayload);
              }
            },
          }),
        );
        testClients.push(chatClient);

        const sessionKey = "agent:main:telegram:direct:123456";
        const idempotencyKey = `idem-${randomUUID()}`;
        const sendRes = await chatClient.request("chat.send", {
          sessionKey,
          message: "/whoami",
          idempotencyKey,
        });
        expect(sendRes.status).toBe("started");
        const runId = sendRes.runId;
        expect(typeof runId).toBe("string");

        const finalEvent = await waitForChatFinalEvent({
          events: chatEvents,
          runId: String(runId),
          sessionKey,
          timeoutMs: 45_000,
        });
        const finalText = extractFirstTextBlock(finalEvent.message);
        expect(typeof finalText).toBe("string");
        expect(finalText?.length).toBeGreaterThan(0);
      } finally {
        await stopTrackedClients(testClients);
        await stopTrackedInstances(testInstances);
      }
    },
  );
});
