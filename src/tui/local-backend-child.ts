import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { TuiBackend } from "./tui-backend.js";

type ChildRequest =
  | {
      type: "request";
      id?: number;
      method?: string;
      params?: unknown;
    }
  | {
      type: "stop";
    };

type BackendMethod = keyof Pick<
  TuiBackend,
  | "sendChat"
  | "steerChat"
  | "abortChat"
  | "loadHistory"
  | "listSessions"
  | "listAgents"
  | "patchSession"
  | "resetSession"
  | "getGatewayStatus"
  | "listModels"
  | "listTools"
  | "listSkills"
>;

const backendMethods = new Set<string>([
  "sendChat",
  "steerChat",
  "abortChat",
  "loadHistory",
  "listSessions",
  "listAgents",
  "patchSession",
  "resetSession",
  "getGatewayStatus",
  "listModels",
  "listTools",
  "listSkills",
]);

function writeProtocol(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redirectConsoleToStderr() {
  const write = (level: string, args: unknown[]) => {
    const line = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
    process.stderr.write(`[tui-local-backend:${level}] ${line}\n`);
  };
  console.log = (...args: unknown[]) => write("log", args);
  console.info = (...args: unknown[]) => write("info", args);
  console.warn = (...args: unknown[]) => write("warn", args);
  console.error = (...args: unknown[]) => write("error", args);
}

export async function invokeBackend(
  backend: TuiBackend,
  method: BackendMethod,
  params: unknown,
): Promise<unknown> {
  if (method === "resetSession") {
    const payload = params as { key?: unknown; reason?: unknown };
    return await backend.resetSession(
      typeof payload?.key === "string" ? payload.key : "",
      payload?.reason === "new" ? "new" : payload?.reason === "reset" ? "reset" : undefined,
    );
  }
  const fn = backend[method];
  if (typeof fn !== "function") {
    throw new Error(`local backend method unavailable: ${method}`);
  }
  return await (fn as (this: TuiBackend, params?: unknown) => Promise<unknown>).call(
    backend,
    params,
  );
}

export async function runEmbeddedTuiBackendStdio(): Promise<void> {
  redirectConsoleToStderr();
  const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
  const backend = new EmbeddedTuiBackend();

  backend.onEvent = (event) => writeProtocol({ type: "event", event });
  backend.onConnected = () => writeProtocol({ type: "connected" });
  backend.onDisconnected = (reason) => writeProtocol({ type: "disconnected", reason });
  backend.onGap = (info) => writeProtocol({ type: "gap", info });

  process.once("SIGTERM", () => {
    backend.stop();
    process.exit(0);
  });
  process.once("SIGINT", () => {
    backend.stop();
    process.exit(0);
  });
  process.once("uncaughtException", (error) => {
    writeProtocol({ type: "fatal", error: errorMessage(error) });
    process.exit(1);
  });
  process.once("unhandledRejection", (error) => {
    writeProtocol({ type: "fatal", error: errorMessage(error) });
    process.exit(1);
  });

  backend.start();
  writeProtocol({ type: "ready" });

  const lines = createInterface({
    input: process.stdin,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of lines) {
    let request: ChildRequest;
    try {
      request = JSON.parse(line) as ChildRequest;
    } catch (error) {
      writeProtocol({ type: "fatal", error: `invalid request: ${errorMessage(error)}` });
      continue;
    }

    if (request.type === "stop") {
      backend.stop();
      break;
    }

    if (
      request.type !== "request" ||
      typeof request.id !== "number" ||
      typeof request.method !== "string" ||
      !backendMethods.has(request.method)
    ) {
      writeProtocol({
        type: "response",
        id: request.type === "request" ? request.id : undefined,
        ok: false,
        error: "invalid local backend request",
      });
      continue;
    }

    void invokeBackend(backend, request.method as BackendMethod, request.params)
      .then((result) => {
        writeProtocol({ type: "response", id: request.id, ok: true, result });
      })
      .catch((error) => {
        writeProtocol({ type: "response", id: request.id, ok: false, error: errorMessage(error) });
      });
  }

  backend.stop();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runEmbeddedTuiBackendStdio().catch((error: unknown) => {
    writeProtocol({ type: "fatal", error: errorMessage(error) });
    process.exit(1);
  });
}
