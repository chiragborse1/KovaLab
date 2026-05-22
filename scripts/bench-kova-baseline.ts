import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import type { TuiEvent } from "../src/tui/tui-backend.js";
import type { TuiTurnTracePayload } from "../src/tui/turn-trace.js";

type BaselineProfile = "smoke" | "tui" | "cli" | "gateway" | "full";
type BaselineComponent = "tui" | "cli" | "gateway";

type SummaryStats = {
  avg: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
};

type ChildBenchResult = {
  command: string[];
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  outputPath?: string;
  stdoutTail: string;
  stderrTail: string;
};

type TuiCommandSample = {
  runId: string;
  status: "final" | "error" | "aborted" | "timeout";
  firstEventMs: number | null;
  finalMs: number;
  trace: Record<string, number>;
  slowestDetail: string;
  budgetDetail?: string;
  errorMessage?: string;
};

type TuiBenchResult = {
  command: string;
  currentConfig: boolean;
  runs: number;
  warmup: number;
  startupMs: number;
  summary: {
    finalMs: SummaryStats;
    firstEventMs: SummaryStats | null;
  };
  samples: TuiCommandSample[];
  worker?: {
    outputPath: string;
    durationMs: number;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdoutTail: string;
    stderrTail: string;
  };
};

type BaselineResult = {
  generatedAt: string;
  profile: BaselineProfile;
  components: BaselineComponent[];
  outputPath: string;
  tui?: TuiBenchResult;
  cli?: ChildBenchResult;
  gateway?: ChildBenchResult;
};

type CliOptions = {
  profile: BaselineProfile;
  components: BaselineComponent[];
  runs: number;
  warmup: number;
  timeoutMs: number;
  output: string;
  tuiCommand: string;
  currentConfig: boolean;
  liveMessage?: string;
};

const DEFAULT_PROFILE: BaselineProfile = "smoke";
const DEFAULT_RUNS = 1;
const DEFAULT_WARMUP = 0;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_TUI_COMMAND = "/status";
const DEFAULT_OUTPUT = ".artifacts/kova-baseline/latest.json";

function parseFlagValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function parsePositiveInt(raw: string | undefined, fallback: number, label: string): number {
  if (!raw) {
    return fallback;
  }
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${label} must be an integer`);
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseProfile(raw: string | undefined): BaselineProfile {
  const profile = (raw ?? DEFAULT_PROFILE).trim().toLowerCase();
  if (
    profile === "smoke" ||
    profile === "tui" ||
    profile === "cli" ||
    profile === "gateway" ||
    profile === "full"
  ) {
    return profile;
  }
  throw new Error(`Unknown --profile "${raw}"`);
}

function resolveComponents(profile: BaselineProfile): BaselineComponent[] {
  if (profile === "tui") {
    return ["tui"];
  }
  if (profile === "cli") {
    return ["cli"];
  }
  if (profile === "gateway") {
    return ["gateway"];
  }
  if (profile === "full") {
    return ["tui", "cli", "gateway"];
  }
  return ["tui", "cli"];
}

function parseOptions(argv = process.argv.slice(2)): CliOptions {
  const profile = parseProfile(parseFlagValue(argv, "--profile"));
  return {
    profile,
    components: resolveComponents(profile),
    runs: parsePositiveInt(parseFlagValue(argv, "--runs"), DEFAULT_RUNS, "--runs"),
    warmup: parsePositiveInt(parseFlagValue(argv, "--warmup"), DEFAULT_WARMUP, "--warmup"),
    timeoutMs: parsePositiveInt(
      parseFlagValue(argv, "--timeout-ms"),
      DEFAULT_TIMEOUT_MS,
      "--timeout-ms",
    ),
    output: parseFlagValue(argv, "--output") ?? DEFAULT_OUTPUT,
    tuiCommand: parseFlagValue(argv, "--tui-command") ?? DEFAULT_TUI_COMMAND,
    currentConfig: hasFlag(argv, "--current-config"),
    liveMessage: parseFlagValue(argv, "--live-message"),
  };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle] ?? 0;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function summarizeNumbers(values: number[]): SummaryStats {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    avg: values.length > 0 ? total / values.length : 0,
    p50: median(values),
    p95: percentile(values, 95),
    min: values.length > 0 ? Math.min(...values) : 0,
    max: values.length > 0 ? Math.max(...values) : 0,
  };
}

function tail(text: string, maxLength = 2400): string {
  return text.length <= maxLength ? text : text.slice(-maxLength);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${String(timeoutMs)}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function writeIsolatedConfig(root: string): string {
  const configPath = path.join(root, "kova.json");
  const config = {
    browser: { enabled: false },
    gateway: {
      mode: "local",
      bind: "loopback",
      auth: { mode: "none" },
      controlUi: { enabled: false },
      tailscale: { mode: "off" },
    },
    plugins: {
      enabled: true,
      entries: {
        browser: { enabled: false },
      },
    },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

function applyIsolatedEnv(root: string, configPath: string): Map<string, string | undefined> {
  const keys = [
    "KOVA_CONFIG",
    "KOVA_CONFIG_PATH",
    "KOVA_HOME",
    "KOVA_SKIP_CHANNELS",
    "KOVA_STATE_DIR",
    "KOVA_TUI_TRACE",
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.KOVA_CONFIG = configPath;
  process.env.KOVA_CONFIG_PATH = configPath;
  process.env.KOVA_HOME = root;
  process.env.KOVA_SKIP_CHANNELS = "1";
  process.env.KOVA_STATE_DIR = path.join(root, "state");
  process.env.KOVA_TUI_TRACE = "1";
  mkdirSync(process.env.KOVA_STATE_DIR, { recursive: true });
  return previous;
}

function restoreEnv(previous: Map<string, string | undefined>): void {
  for (const [key, value] of previous.entries()) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

async function runOneTuiCommand(params: {
  backend: import("../src/tui/embedded-backend.js").EmbeddedTuiBackend;
  command: string;
  sessionKey: string;
  timeoutMs: number;
}): Promise<TuiCommandSample> {
  const { buildTuiTraceSegments, summarizeTuiTraceSegments } =
    await import("../src/tui/turn-trace.js");
  const runId = randomUUID();
  const startedAt = performance.now();
  const traces: TuiTurnTracePayload[] = [];
  let firstEventMs: number | null = null;
  const previousOnEvent = params.backend.onEvent;

  const final = new Promise<TuiCommandSample>((resolve) => {
    params.backend.onEvent = (evt: TuiEvent) => {
      previousOnEvent?.(evt);
      if (firstEventMs === null) {
        firstEventMs = performance.now() - startedAt;
      }
      const payload =
        evt.payload && typeof evt.payload === "object"
          ? (evt.payload as { runId?: unknown; state?: unknown; errorMessage?: unknown })
          : null;
      if (evt.event === "trace" && payload?.runId === runId) {
        traces.push(evt.payload as TuiTurnTracePayload);
        return;
      }
      if (evt.event !== "chat" || payload?.runId !== runId) {
        return;
      }
      const state = payload.state;
      if (state !== "final" && state !== "error" && state !== "aborted") {
        return;
      }
      const finalMs = performance.now() - startedAt;
      const trace = Object.fromEntries(traces.map((entry) => [entry.stage, entry.elapsedMs]));
      const { slowestDetail, budgetDetail } = summarizeTuiTraceSegments(
        buildTuiTraceSegments(
          traces.map((entry) => ({ stage: entry.stage, elapsedMs: entry.elapsedMs })),
          finalMs,
        ),
      );
      resolve({
        runId,
        status: state,
        firstEventMs,
        finalMs,
        trace,
        slowestDetail,
        ...(budgetDetail ? { budgetDetail } : {}),
        ...(typeof payload.errorMessage === "string" ? { errorMessage: payload.errorMessage } : {}),
      });
    };
  });

  await params.backend.sendChat({
    sessionKey: params.sessionKey,
    message: params.command,
    deliver: false,
    timeoutMs: params.timeoutMs,
    runId,
  });

  try {
    return await withTimeout(final, params.timeoutMs, `TUI command ${params.command}`);
  } catch (error) {
    await params.backend
      .abortChat({
        sessionKey: params.sessionKey,
        runId,
      })
      .catch(() => undefined);
    return {
      runId,
      status: "timeout",
      firstEventMs,
      finalMs: performance.now() - startedAt,
      trace: Object.fromEntries(traces.map((entry) => [entry.stage, entry.elapsedMs])),
      slowestDetail: "slowest unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    params.backend.onEvent = previousOnEvent;
  }
}

async function runTuiBenchmarkInline(options: CliOptions): Promise<TuiBenchResult> {
  const root = options.currentConfig
    ? undefined
    : mkdtempSync(path.join(tmpdir(), "kova-tui-bench-"));
  const previousEnv = new Map<string, string | undefined>([
    ["KOVA_TUI_TRACE", process.env.KOVA_TUI_TRACE],
  ]);
  let isolatedEnv: Map<string, string | undefined> | undefined;
  try {
    process.env.KOVA_TUI_TRACE = "1";
    if (root) {
      const configPath = writeIsolatedConfig(root);
      isolatedEnv = applyIsolatedEnv(root, configPath);
      process.env.KOVA_TUI_TRACE = "1";
    }

    const { EmbeddedTuiBackend } = await import("../src/tui/embedded-backend.js");
    const backend = new EmbeddedTuiBackend();
    const startupStartedAt = performance.now();
    const connected = new Promise<void>((resolve) => {
      backend.onConnected = resolve;
    });
    backend.start();
    await withTimeout(connected, options.timeoutMs, "TUI backend startup");
    const startupMs = performance.now() - startupStartedAt;
    const samples: TuiCommandSample[] = [];
    const sessionKey = `agent:main:tui-bench-${randomUUID()}`;
    const totalRuns = options.warmup + options.runs;
    try {
      for (let index = 0; index < totalRuns; index += 1) {
        const sample = await runOneTuiCommand({
          backend,
          command: options.liveMessage ?? options.tuiCommand,
          sessionKey,
          timeoutMs: options.timeoutMs,
        });
        if (index >= options.warmup) {
          samples.push(sample);
        }
      }
    } finally {
      backend.stop();
    }
    const firstEventValues = samples
      .map((sample) => sample.firstEventMs)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return {
      command: options.liveMessage ?? options.tuiCommand,
      currentConfig: options.currentConfig,
      runs: options.runs,
      warmup: options.warmup,
      startupMs,
      summary: {
        finalMs: summarizeNumbers(samples.map((sample) => sample.finalMs)),
        firstEventMs: firstEventValues.length > 0 ? summarizeNumbers(firstEventValues) : null,
      },
      samples,
    };
  } finally {
    if (isolatedEnv) {
      restoreEnv(isolatedEnv);
    }
    restoreEnv(previousEnv);
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
}

function runTuiBenchmarkWorker(options: CliOptions, outputPath: string): TuiBenchResult {
  const startedAt = performance.now();
  const timeoutMs = options.timeoutMs * Math.max(1, options.runs + options.warmup) + 5_000;
  const args = [
    "--import",
    "tsx",
    "scripts/bench-kova-baseline.ts",
    "--tui-worker",
    "--profile",
    "tui",
    "--runs",
    String(options.runs),
    "--warmup",
    String(options.warmup),
    "--timeout-ms",
    String(options.timeoutMs),
    "--tui-command",
    options.tuiCommand,
    "--worker-output",
    outputPath,
    ...(options.currentConfig ? ["--current-config"] : []),
    ...(options.liveMessage ? ["--live-message", options.liveMessage] : []),
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      NODE_NO_WARNINGS: "1",
    },
  });
  const worker = {
    outputPath,
    durationMs: performance.now() - startedAt,
    exitCode: result.status,
    signal: result.signal,
    stdoutTail: tail(result.stdout ?? ""),
    stderrTail: tail(result.stderr ?? ""),
  };
  if (existsSync(outputPath)) {
    try {
      const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as TuiBenchResult;
      return { ...parsed, worker };
    } catch (error) {
      return buildFailedTuiWorkerResult(
        options,
        worker,
        `failed to read worker output: ${String(error)}`,
      );
    }
  }
  return buildFailedTuiWorkerResult(
    options,
    worker,
    result.error ? String(result.error) : "TUI benchmark worker failed",
  );
}

function buildFailedTuiWorkerResult(
  options: CliOptions,
  worker: NonNullable<TuiBenchResult["worker"]>,
  message: string,
): TuiBenchResult {
  const finalMs = worker.durationMs;
  return {
    command: options.liveMessage ?? options.tuiCommand,
    currentConfig: options.currentConfig,
    runs: options.runs,
    warmup: options.warmup,
    startupMs: 0,
    summary: {
      finalMs: summarizeNumbers([finalMs]),
      firstEventMs: null,
    },
    samples: [
      {
        runId: "tui-worker",
        status: "timeout",
        firstEventMs: null,
        finalMs,
        trace: {},
        slowestDetail: "slowest worker",
        errorMessage: message,
      },
    ],
    worker,
  };
}

function runChildBenchmark(params: {
  args: string[];
  outputPath: string;
  timeoutMs: number;
}): ChildBenchResult {
  const startedAt = performance.now();
  const result = spawnSync(process.execPath, params.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: params.timeoutMs,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      NODE_NO_WARNINGS: "1",
    },
  });
  return {
    command: [process.execPath, ...params.args],
    durationMs: performance.now() - startedAt,
    exitCode: result.status,
    signal: result.signal,
    outputPath: params.outputPath,
    stdoutTail: tail(result.stdout ?? ""),
    stderrTail: tail(result.stderr ?? ""),
  };
}

function printHelp(): void {
  console.log(`Kova baseline benchmark

Usage:
  node --import tsx scripts/bench-kova-baseline.ts [options]

Profiles:
  smoke     TUI hot path + tiny CLI startup sample (default)
  tui       TUI local embedded command benchmark only
  cli       CLI startup benchmark only
  gateway   Gateway startup benchmark only
  full      TUI + CLI + Gateway startup

Options:
  --profile <smoke|tui|cli|gateway|full>
  --runs <n>              measured runs per component (default ${String(DEFAULT_RUNS)})
  --warmup <n>            warmup runs per component (default ${String(DEFAULT_WARMUP)})
  --timeout-ms <ms>       per-run timeout (default ${String(DEFAULT_TIMEOUT_MS)})
  --tui-command <text>    local command for TUI hot-path timing (default "${DEFAULT_TUI_COMMAND}")
  --live-message <text>   replace the final TUI sample with a real provider message
  --current-config        use the current Kova config instead of an isolated temp config
  --output <path>         write JSON summary (default ${DEFAULT_OUTPUT})
`);
}

async function main(): Promise<void> {
  if (hasFlag(process.argv, "--help") || hasFlag(process.argv, "-h")) {
    printHelp();
    return;
  }
  const options = parseOptions();
  if (hasFlag(process.argv, "--tui-worker")) {
    const workerOutput = parseFlagValue(process.argv, "--worker-output");
    if (!workerOutput) {
      throw new Error("--worker-output is required for --tui-worker");
    }
    const tui = await runTuiBenchmarkInline(options);
    mkdirSync(path.dirname(workerOutput), { recursive: true });
    writeFileSync(workerOutput, `${JSON.stringify(tui, null, 2)}\n`);
    return;
  }
  const outputDir = path.dirname(options.output);
  mkdirSync(outputDir, { recursive: true });
  const artifactBase = path.join(
    outputDir,
    path.basename(options.output, path.extname(options.output)),
  );
  const result: BaselineResult = {
    generatedAt: new Date().toISOString(),
    profile: options.profile,
    components: options.components,
    outputPath: options.output,
  };

  if (options.components.includes("tui")) {
    result.tui = runTuiBenchmarkWorker(options, `${artifactBase}.tui.json`);
  }
  if (options.components.includes("cli")) {
    const cliOutput = `${artifactBase}.cli-startup.json`;
    result.cli = runChildBenchmark({
      args: [
        "--import",
        "tsx",
        "scripts/bench-cli-startup.ts",
        "--case",
        "version",
        "--case",
        options.profile === "full" ? "statusJson" : "help",
        "--runs",
        String(options.runs),
        "--warmup",
        String(options.warmup),
        "--output",
        cliOutput,
      ],
      outputPath: cliOutput,
      timeoutMs: options.timeoutMs * Math.max(1, options.runs + options.warmup),
    });
  }
  if (options.components.includes("gateway")) {
    const gatewayOutput = `${artifactBase}.gateway-startup.json`;
    result.gateway = runChildBenchmark({
      args: [
        "--import",
        "tsx",
        "scripts/bench-gateway-startup.ts",
        "--case",
        "skipChannels",
        "--runs",
        String(options.runs),
        "--warmup",
        String(options.warmup),
        "--output",
        gatewayOutput,
      ],
      outputPath: gatewayOutput,
      timeoutMs: options.timeoutMs * Math.max(1, options.runs + options.warmup),
    });
  }

  writeFileSync(options.output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`baseline written: ${options.output}`);
  if (result.tui) {
    console.log(
      `tui ${result.tui.command}: p50=${Math.round(result.tui.summary.finalMs.p50)}ms ` +
        `p95=${Math.round(result.tui.summary.finalMs.p95)}ms startup=${Math.round(
          result.tui.startupMs,
        )}ms`,
    );
  }
  for (const [label, child] of [
    ["cli", result.cli],
    ["gateway", result.gateway],
  ] as const) {
    if (!child) {
      continue;
    }
    console.log(
      `${label}: exit=${String(child.exitCode)} signal=${String(child.signal ?? "none")} artifact=${
        child.outputPath ?? "none"
      }`,
    );
  }
  const childFailed = [result.cli, result.gateway].some(
    (child) => child && (child.exitCode !== 0 || child.signal),
  );
  if (childFailed) {
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exit(1);
    });
}

export const testing = {
  parseOptions,
  parsePositiveInt,
  parseProfile,
  resolveComponents,
  summarizeNumbers,
};
