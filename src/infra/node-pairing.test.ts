import fs from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createSuiteTempRootTracker } from "../test-helpers/temp-dir.js";
import {
  approveNodePairing,
  getPairedNode,
  listNodePairing,
  removePairedNode,
  requestNodePairing,
  verifyNodeToken,
} from "./node-pairing.js";
import { resolvePairingPaths } from "./pairing-files.js";

async function setupPairedNode(baseDir: string): Promise<string> {
  const request = await requestNodePairing(
    {
      nodeId: "node-1",
      platform: "darwin",
      commands: ["system.run"],
    },
    baseDir,
  );
  await approveNodePairing(
    request.request.requestId,
    { callerScopes: ["operator.pairing", "operator.admin"] },
    baseDir,
  );
  const paired = await getPairedNode("node-1", baseDir);
  expect(paired).not.toBeNull();
  if (!paired) {
    throw new Error("expected node to be paired");
  }
  return paired.token;
}

const tempDirs = createSuiteTempRootTracker({ prefix: "openclaw-node-pairing-" });

async function withNodePairingDir<T>(run: (baseDir: string) => Promise<T>): Promise<T> {
  return await run(await tempDirs.make("case"));
}

describe("node pairing tokens", () => {
  beforeAll(async () => {
    await tempDirs.setup();
  });

  afterAll(async () => {
    await tempDirs.cleanup();
  });

  test("reuses pending requests for metadata refreshes", async () => {
    await withNodePairingDir(async (baseDir) => {
      const first = await requestNodePairing(
        {
          nodeId: "node-1",
          platform: "darwin",
        },
        baseDir,
      );
      const second = await requestNodePairing(
        {
          nodeId: "node-1",
          platform: "darwin",
        },
        baseDir,
      );

      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.request.requestId).toBe(first.request.requestId);

      const commandFirst = await requestNodePairing(
        {
          nodeId: "node-2",
          platform: "darwin",
          commands: ["canvas.snapshot"],
        },
        baseDir,
      );

      const commandSecond = await requestNodePairing(
        {
          nodeId: "node-2",
          platform: "darwin",
          displayName: "Updated Node",
          commands: ["canvas.snapshot"],
        },
        baseDir,
      );

      expect(commandSecond.created).toBe(false);
      expect(commandSecond.superseded).toBeUndefined();
      expect(commandSecond.request.requestId).toBe(commandFirst.request.requestId);
      expect(commandSecond.request.displayName).toBe("Updated Node");
      expect(commandSecond.request.commands).toEqual(["canvas.snapshot"]);

      const reorderedFirst = await requestNodePairing(
        {
          nodeId: "node-3",
          platform: "darwin",
          caps: ["camera", "screen"],
          commands: ["canvas.snapshot", "system.run"],
        },
        baseDir,
      );
      const reorderedSecond = await requestNodePairing(
        {
          nodeId: "node-3",
          platform: "darwin",
          caps: ["screen", "camera"],
          commands: ["system.run", "canvas.snapshot"],
        },
        baseDir,
      );

      expect(reorderedSecond.created).toBe(false);
      expect(reorderedSecond.superseded).toBeUndefined();
      expect(reorderedSecond.request.requestId).toBe(reorderedFirst.request.requestId);

      await requestNodePairing(
        {
          nodeId: "node-4",
          platform: "darwin",
          commands: ["canvas.present"],
        },
        baseDir,
      );

      await expect(listNodePairing(baseDir)).resolves.toEqual({
        pending: expect.arrayContaining([
          expect.objectContaining({
            nodeId: "node-4",
            commands: ["canvas.present"],
            requiredApproveScopes: ["operator.pairing", "operator.write"],
          }),
        ]),
        paired: [],
      });
    });
  });

  test("supersedes pending requests when the approval surface changes", async () => {
    await withNodePairingDir(async (baseDir) => {
      const first = await requestNodePairing(
        {
          nodeId: "node-1",
          platform: "darwin",
          caps: ["camera"],
          commands: ["canvas.snapshot"],
          permissions: { camera: true },
        },
        baseDir,
      );
      const second = await requestNodePairing(
        {
          nodeId: "node-1",
          platform: "darwin",
          commands: ["canvas.snapshot", "system.run"],
        },
        baseDir,
      );

      expect(second.created).toBe(true);
      expect(second.superseded).toEqual([{ requestId: first.request.requestId, nodeId: "node-1" }]);
      expect(second.request.requestId).not.toBe(first.request.requestId);

      const list = await listNodePairing(baseDir);
      expect(list.pending).toHaveLength(1);
      expect(list.pending[0]?.requestId).toBe(second.request.requestId);
      expect(list.pending[0]?.caps).toEqual(["camera"]);
      expect(list.pending[0]?.commands).toEqual(["canvas.snapshot", "system.run"]);
      expect(list.pending[0]?.permissions).toEqual({ camera: true });

      await expect(
        approveNodePairing(
          first.request.requestId,
          { callerScopes: ["operator.pairing", "operator.admin"] },
          baseDir,
        ),
      ).resolves.toBeNull();

      const approved = await approveNodePairing(
        second.request.requestId,
        { callerScopes: ["operator.pairing", "operator.admin"] },
        baseDir,
      );
      expect(approved).toEqual(
        expect.objectContaining({
          requestId: second.request.requestId,
          node: expect.objectContaining({
            caps: ["camera"],
            commands: ["canvas.snapshot", "system.run"],
            permissions: { camera: true },
          }),
        }),
      );

      const capsFirst = await requestNodePairing(
        {
          nodeId: "node-2",
          platform: "darwin",
          caps: ["camera"],
        },
        baseDir,
      );
      const capsSecond = await requestNodePairing(
        {
          nodeId: "node-2",
          platform: "darwin",
          caps: ["camera", "screen"],
        },
        baseDir,
      );
      expect(capsSecond.created).toBe(true);
      expect(capsSecond.superseded).toEqual([
        { requestId: capsFirst.request.requestId, nodeId: "node-2" },
      ]);
      expect(capsSecond.request.requestId).not.toBe(capsFirst.request.requestId);

      const permissionsFirst = await requestNodePairing(
        {
          nodeId: "node-3",
          platform: "darwin",
          permissions: { camera: true },
        },
        baseDir,
      );
      const permissionsSecond = await requestNodePairing(
        {
          nodeId: "node-3",
          platform: "darwin",
          permissions: { camera: true, screen: true },
        },
        baseDir,
      );

      expect(permissionsSecond.created).toBe(true);
      expect(permissionsSecond.superseded).toEqual([
        { requestId: permissionsFirst.request.requestId, nodeId: "node-3" },
      ]);
      expect(permissionsSecond.request.requestId).not.toBe(permissionsFirst.request.requestId);
    });
  });

  test("generates base64url node tokens and rejects mismatches", async () => {
    await withNodePairingDir(async (baseDir) => {
      const token = await setupPairedNode(baseDir);

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
      await expect(verifyNodeToken("node-1", token, baseDir)).resolves.toEqual({
        ok: true,
        node: expect.objectContaining({ nodeId: "node-1" }),
      });
      await expect(verifyNodeToken("node-1", "x".repeat(token.length), baseDir)).resolves.toEqual({
        ok: false,
      });

      const multibyteToken = "é".repeat(token.length);
      expect(Buffer.from(multibyteToken).length).not.toBe(Buffer.from(token).length);

      await expect(verifyNodeToken("node-1", multibyteToken, baseDir)).resolves.toEqual({
        ok: false,
      });
    });
  });

  test("removes paired nodes without disturbing pending requests", async () => {
    await withNodePairingDir(async (baseDir) => {
      await setupPairedNode(baseDir);
      const pending = await requestNodePairing(
        {
          nodeId: "node-2",
          platform: "darwin",
        },
        baseDir,
      );

      await expect(removePairedNode("node-1", baseDir)).resolves.toEqual({ nodeId: "node-1" });
      await expect(removePairedNode("node-1", baseDir)).resolves.toBeNull();
      await expect(getPairedNode("node-1", baseDir)).resolves.toBeNull();
      await expect(listNodePairing(baseDir)).resolves.toEqual({
        pending: [
          expect.objectContaining({
            requestId: pending.request.requestId,
            nodeId: "node-2",
          }),
        ],
        paired: [],
      });
    });
  });

  test("requires the right scopes to approve node requests", async () => {
    await withNodePairingDir(async (baseDir) => {
      const systemRunRequest = await requestNodePairing(
        {
          nodeId: "node-1",
          platform: "darwin",
          commands: ["system.run"],
        },
        baseDir,
      );

      await expect(
        approveNodePairing(
          systemRunRequest.request.requestId,
          { callerScopes: ["operator.pairing"] },
          baseDir,
        ),
      ).resolves.toEqual({
        status: "forbidden",
        missingScope: "operator.admin",
      });
      await expect(getPairedNode("node-1", baseDir)).resolves.toBeNull();

      const commandlessRequest = await requestNodePairing(
        {
          nodeId: "node-2",
          platform: "darwin",
        },
        baseDir,
      );

      await expect(
        approveNodePairing(commandlessRequest.request.requestId, { callerScopes: [] }, baseDir),
      ).resolves.toEqual({
        status: "forbidden",
        missingScope: "operator.pairing",
      });
      await expect(
        approveNodePairing(
          commandlessRequest.request.requestId,
          { callerScopes: ["operator.pairing"] },
          baseDir,
        ),
      ).resolves.toEqual({
        requestId: commandlessRequest.request.requestId,
        node: expect.objectContaining({
          nodeId: "node-2",
          commands: undefined,
        }),
      });
    });
  });

  test("refuses to overwrite corrupt paired node state when requesting pairing", async () => {
    await withNodePairingDir(async (baseDir) => {
      const { dir, pairedPath } = resolvePairingPaths(baseDir, "nodes");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(pairedPath, "{not-json}", "utf8");

      await expect(
        requestNodePairing(
          {
            nodeId: "node-1",
            platform: "darwin",
          },
          baseDir,
        ),
      ).rejects.toThrow(/paired\.json/);
      await expect(fs.readFile(pairedPath, "utf8")).resolves.toBe("{not-json}");
    });
  });
});
