import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { request as httpRequest } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { extractFirstTextBlock } from "../../src/shared/chat-message-content.js";
import { sleep } from "../../src/utils.js";

export { extractFirstTextBlock };

export type ChatEventPayload = {
  runId?: string;
  sessionKey?: string;
  state?: string;
  message?: unknown;
};

export type GatewayInstance = {
  name: string;
  port: number;
  hookToken: string;
  gatewayToken: string;
  homeDir: string;
  stateDir: string;
  configPath: string;
  child: ChildProcessWithoutNullStreams;
  stdout: string[];
  stderr: string[];
};

const GATEWAY_START_TIMEOUT_MS = 60_000;
const GATEWAY_STOP_TIMEOUT_MS = 1_500;
const GATEWAY_HOME_REMOVE_RETRIES = 5;
const GATEWAY_HOME_REMOVE_RETRY_DELAY_MS = 100;
const GATEWAY_ENTRYPOINT_PREPARE_TIMEOUT_MS = 120_000;

let gatewayEntrypointPromise: Promise<string[]> | null = null;

async function resolveBuiltGatewayEntrypoint(cwd: string): Promise<string[] | null> {
  const buildStampPath = path.join(cwd, "dist", ".buildstamp");
  const runtimePostBuildStampPath = path.join(cwd, "dist", ".runtime-postbuildstamp");
  for (const entrypoint of ["dist/index.js", "dist/index.mjs"]) {
    try {
      await Promise.all([
        fs.access(path.join(cwd, entrypoint)),
        fs.access(buildStampPath),
        fs.access(runtimePostBuildStampPath),
      ]);
      return [entrypoint];
    } catch {
      // try the next built entrypoint
    }
  }
  return null;
}

async function prepareGatewayEntrypoint(cwd: string): Promise<string[]> {
  const builtEntrypoint = await resolveBuiltGatewayEntrypoint(cwd);
  if (builtEntrypoint) {
    return builtEntrypoint;
  }

  const stdout: string[] = [];
  const stderr: string[] = [];
  const child = spawn("node", ["scripts/run-node.mjs", "--help"], {
    cwd,
    env: { ...process.env, VITEST: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (d) => stdout.push(String(d)));
  child.stderr?.on("data", (d) => stderr.push(String(d)));

  const completed = await Promise.race([
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    }),
    sleep(GATEWAY_ENTRYPOINT_PREPARE_TIMEOUT_MS).then(() => null),
  ]);

  if (completed === null) {
    child.kill("SIGKILL");
    throw new Error(
      `timeout preparing gateway entrypoint\n--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
    );
  }
  if (completed.code !== 0) {
    throw new Error(
      `failed preparing gateway entrypoint (code=${String(completed.code)} signal=${String(
        completed.signal,
      )})\n--- stdout ---\n${stdout.join("")}\n--- stderr ---\n${stderr.join("")}`,
    );
  }

  return (await resolveBuiltGatewayEntrypoint(cwd)) ?? ["scripts/run-node.mjs"];
}

async function resolveGatewayEntrypoint(cwd: string): Promise<string[]> {
  gatewayEntrypointPromise ??= prepareGatewayEntrypoint(cwd);
  return await gatewayEntrypointPromise;
}

const getFreePort = async () => {
  const srv = net.createServer();
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const addr = srv.address();
  if (!addr || typeof addr === "string") {
    srv.close();
    throw new Error("failed to bind ephemeral port");
  }
  await new Promise<void>((resolve) => srv.close(() => resolve()));
  return addr.port;
};

async function waitForPortOpen(
  proc: ChildProcessWithoutNullStreams,
  chunksOut: string[],
  chunksErr: string[],
  port: number,
  timeoutMs: number,
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (proc.exitCode !== null) {
      const stdout = chunksOut.join("");
      const stderr = chunksErr.join("");
      throw new Error(
        `gateway exited before listening (code=${String(proc.exitCode)} signal=${String(proc.signalCode)})\n` +
          `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
      );
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ host: "127.0.0.1", port });
        socket.once("connect", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", (err) => {
          socket.destroy();
          reject(err);
        });
      });
      return;
    } catch {
      // keep polling
    }

    await sleep(10);
  }
  const stdout = chunksOut.join("");
  const stderr = chunksErr.join("");
  throw new Error(
    `timeout waiting for gateway to listen on port ${port}\n` +
      `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`,
  );
}

async function waitForGatewayExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  return await Promise.race([
    new Promise<boolean>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return resolve(true);
      }
      child.once("exit", () => resolve(true));
    }),
    sleep(timeoutMs).then(() => false),
  ]);
}

async function removeGatewayHome(homeDir: string) {
  await fs.rm(homeDir, {
    recursive: true,
    force: true,
    maxRetries: GATEWAY_HOME_REMOVE_RETRIES,
    retryDelay: GATEWAY_HOME_REMOVE_RETRY_DELAY_MS,
  });
}

export async function spawnGatewayInstance(name: string): Promise<GatewayInstance> {
  const port = await getFreePort();
  const hookToken = `token-${name}-${randomUUID()}`;
  const gatewayToken = `gateway-${name}-${randomUUID()}`;
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), `kova-e2e-${name}-`));
  const configDir = path.join(homeDir, ".kova");
  await fs.mkdir(configDir, { recursive: true });
  const configPath = path.join(configDir, "kova.json");
  const stateDir = path.join(configDir, "state");
  const config = {
    gateway: {
      port,
      auth: { mode: "token", token: gatewayToken },
      controlUi: { enabled: false },
    },
    hooks: { enabled: true, token: hookToken, path: "/hooks" },
  };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");

  const stdout: string[] = [];
  const stderr: string[] = [];
  let child: ChildProcessWithoutNullStreams | null = null;

  try {
    const cwd = process.cwd();
    const entrypoint = await resolveGatewayEntrypoint(cwd);
    child = spawn(
      "node",
      [
        ...entrypoint,
        "gateway",
        "--port",
        String(port),
        "--bind",
        "loopback",
        "--allow-unconfigured",
      ],
      {
        cwd,
        env: {
          ...process.env,
          HOME: homeDir,
          KOVA_CONFIG_PATH: configPath,
          KOVA_STATE_DIR: stateDir,
          KOVA_GATEWAY_TOKEN: "",
          KOVA_GATEWAY_PASSWORD: "",
          KOVA_SKIP_CHANNELS: "1",
          KOVA_SKIP_PROVIDERS: "1",
          KOVA_SKIP_GMAIL_WATCHER: "1",
          KOVA_SKIP_CRON: "1",
          KOVA_SKIP_BROWSER_CONTROL_SERVER: "1",
          KOVA_SKIP_CANVAS_HOST: "1",
          KOVA_TEST_MINIMAL_GATEWAY: "1",
          VITEST: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (d) => stdout.push(String(d)));
    child.stderr?.on("data", (d) => stderr.push(String(d)));

    await waitForPortOpen(child, stdout, stderr, port, GATEWAY_START_TIMEOUT_MS);

    return {
      name,
      port,
      hookToken,
      gatewayToken,
      homeDir,
      stateDir,
      configPath,
      child,
      stdout,
      stderr,
    };
  } catch (err) {
    if (child && child.exitCode === null && !child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      await waitForGatewayExit(child, GATEWAY_STOP_TIMEOUT_MS);
    }
    await removeGatewayHome(homeDir);
    throw err;
  }
}

export async function stopGatewayInstance(inst: GatewayInstance) {
  if (inst.child.exitCode === null && !inst.child.killed) {
    try {
      inst.child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  let exited = await waitForGatewayExit(inst.child, GATEWAY_STOP_TIMEOUT_MS);
  if (!exited && inst.child.exitCode === null && !inst.child.killed) {
    try {
      inst.child.kill("SIGKILL");
    } catch {
      // ignore
    }
    await waitForGatewayExit(inst.child, GATEWAY_STOP_TIMEOUT_MS);
  }
  await removeGatewayHome(inst.homeDir);
}

export async function postJson(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; json: unknown }> {
  const payload = JSON.stringify(body);
  const parsed = new URL(url);
  return await new Promise<{ status: number; json: unknown }>((resolve, reject) => {
    const req = httpRequest(
      {
        method: "POST",
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: `${parsed.pathname}${parsed.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let json: unknown = null;
          if (data.trim()) {
            try {
              json = JSON.parse(data);
            } catch {
              json = data;
            }
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export async function waitForChatFinalEvent(params: {
  events: ChatEventPayload[];
  runId: string;
  sessionKey: string;
  timeoutMs?: number;
}): Promise<ChatEventPayload> {
  const deadline = Date.now() + (params.timeoutMs ?? 15_000);
  while (Date.now() < deadline) {
    const match = params.events.find(
      (evt) =>
        evt.runId === params.runId && evt.sessionKey === params.sessionKey && evt.state === "final",
    );
    if (match) {
      return match;
    }
    await sleep(20);
  }
  throw new Error(`timeout waiting for final chat event (runId=${params.runId})`);
}
