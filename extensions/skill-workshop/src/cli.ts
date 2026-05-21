import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import type { KovaConfig } from "getkova/plugin-sdk/core";
import { resolveStateDir } from "getkova/plugin-sdk/state-paths";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../api.js";
import type { SkillWorkshopConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import { applyProposalToWorkspace } from "./skills.js";
import { SkillWorkshopStore } from "./store.js";
import type { SkillChange, SkillProposal, SkillWorkshopStatus } from "./types.js";

type SkillWorkshopCliIo = {
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
  exit?: (code: number) => void;
};

type SkillWorkshopCliContext = {
  config: KovaConfig;
  workspaceDir?: string;
  stateDir?: string;
  io?: SkillWorkshopCliIo;
};

type CommonOptions = {
  agent?: string;
  workspace?: string;
  json?: boolean;
};

type ListOptions = CommonOptions & {
  status?: string;
};

type ApplyOptions = CommonOptions & {
  yes?: boolean;
};

const STATUSES: SkillWorkshopStatus[] = ["pending", "applied", "rejected", "quarantined"];

class SkillWorkshopCliFailure extends Error {}

function writeLine(io: SkillWorkshopCliIo | undefined, stream: "stdout" | "stderr", text: string) {
  const normalized = text.endsWith("\n") ? text : `${text}\n`;
  const writer = stream === "stdout" ? io?.writeStdout : io?.writeStderr;
  if (writer) {
    writer(normalized);
    return;
  }
  if (stream === "stdout") {
    process.stdout.write(normalized);
    return;
  }
  process.stderr.write(normalized);
}

function setExitCode(io: SkillWorkshopCliIo | undefined, code: number): void {
  if (io?.exit) {
    io.exit(code);
    return;
  }
  process.exitCode = code;
}

function fail(io: SkillWorkshopCliIo | undefined, message: string): never {
  writeLine(io, "stderr", message);
  setExitCode(io, 1);
  throw new SkillWorkshopCliFailure(message);
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function withCliErrors<T extends unknown[]>(
  ctx: SkillWorkshopCliContext,
  handler: (...args: T) => Promise<void>,
): (...args: T) => Promise<void> {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      if (error instanceof SkillWorkshopCliFailure) {
        return;
      }
      writeLine(ctx.io, "stderr", formatUnknownError(error));
      setExitCode(ctx.io, 1);
    }
  };
}

function readPluginConfig(config: KovaConfig): SkillWorkshopConfig {
  const plugins = config.plugins;
  const entries =
    plugins && typeof plugins === "object" && !Array.isArray(plugins)
      ? (plugins as { entries?: unknown }).entries
      : undefined;
  const workshop =
    entries && typeof entries === "object" && !Array.isArray(entries)
      ? (entries as Record<string, unknown>)["skill-workshop"]
      : undefined;
  const raw =
    workshop && typeof workshop === "object" && !Array.isArray(workshop)
      ? (workshop as { config?: unknown }).config
      : undefined;
  return resolveConfig(raw);
}

function resolveWorkspaceDir(ctx: SkillWorkshopCliContext, opts?: CommonOptions): string {
  if (opts?.workspace?.trim()) {
    return path.resolve(opts.workspace.trim());
  }
  if (opts?.agent?.trim()) {
    return resolveAgentWorkspaceDir(ctx.config, opts.agent.trim());
  }
  if (ctx.workspaceDir?.trim()) {
    return path.resolve(ctx.workspaceDir);
  }
  return resolveAgentWorkspaceDir(ctx.config, resolveDefaultAgentId(ctx.config));
}

function createStore(ctx: SkillWorkshopCliContext, workspaceDir: string): SkillWorkshopStore {
  return new SkillWorkshopStore({
    stateDir: ctx.stateDir ?? resolveStateDir(),
    workspaceDir,
  });
}

function parseStatus(value: string | undefined, io: SkillWorkshopCliIo | undefined) {
  const status = value?.trim() as SkillWorkshopStatus | undefined;
  if (!status) {
    return undefined;
  }
  if (STATUSES.includes(status)) {
    return status;
  }
  fail(io, `Invalid status "${value}". Use one of: ${STATUSES.join(", ")}.`);
}

function oneLine(value: string, max = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, max - 3))}...`;
}

function formatChangeKind(change: SkillChange): string {
  if (change.kind === "create") {
    return "create";
  }
  if (change.kind === "append") {
    return `append:${change.section}`;
  }
  return "replace";
}

function formatProposalRow(proposal: SkillProposal): string {
  const findings = proposal.scanFindings ?? [];
  const critical = findings.filter((finding) => finding.severity === "critical").length;
  const warn = findings.filter((finding) => finding.severity === "warn").length;
  const findingText =
    critical > 0 ? `critical:${critical}` : warn > 0 ? `warn:${warn}` : "findings:0";
  return [
    proposal.id,
    proposal.status.padEnd(11),
    proposal.skillName.padEnd(28),
    formatChangeKind(proposal.change).padEnd(18),
    findingText.padEnd(12),
    oneLine(proposal.reason, 80),
  ].join("  ");
}

function formatProposalList(params: {
  title: string;
  workspaceDir: string;
  proposals: SkillProposal[];
  empty: string;
}): string {
  const lines: string[] = [];
  lines.push(params.title);
  lines.push(`Workspace: ${params.workspaceDir}`);
  lines.push("");
  if (params.proposals.length === 0) {
    lines.push(params.empty);
    return lines.join("\n");
  }
  lines.push(
    [
      "ID",
      "Status".padEnd(11),
      "Skill".padEnd(28),
      "Change".padEnd(18),
      "Scan".padEnd(12),
      "Reason",
    ].join("  "),
  );
  for (const proposal of params.proposals) {
    lines.push(formatProposalRow(proposal));
  }
  lines.push("");
  lines.push("No files changed. Inspect first, then apply explicitly with --yes.");
  lines.push("Examples:");
  lines.push("  kova skill-workshop inspect <id>");
  lines.push("  kova skill-workshop apply <id> --yes");
  lines.push("  kova skill-workshop reject <id>");
  return lines.join("\n");
}

function formatChangeDetails(change: SkillChange): string[] {
  if (change.kind === "create") {
    return ["Change: create", `Description: ${change.description}`, "", change.body];
  }
  if (change.kind === "append") {
    return [
      "Change: append",
      `Section: ${change.section}`,
      ...(change.description ? [`Description: ${change.description}`] : []),
      "",
      change.body,
    ];
  }
  return ["Change: replace", "", "Old text:", change.oldText, "", "New text:", change.newText];
}

function formatProposalDetails(proposal: SkillProposal): string {
  const lines: string[] = [];
  lines.push(`Skill Workshop Proposal: ${proposal.id}`);
  lines.push(`Status: ${proposal.status}`);
  lines.push(`Workspace: ${proposal.workspaceDir}`);
  lines.push(`Skill: ${proposal.skillName}`);
  lines.push(`Title: ${proposal.title}`);
  lines.push(`Reason: ${proposal.reason}`);
  lines.push(`Source: ${proposal.source}`);
  if (proposal.quarantineReason) {
    lines.push(`Quarantine: ${proposal.quarantineReason}`);
  }
  if (proposal.scanFindings?.length) {
    lines.push("");
    lines.push("Scan findings:");
    for (const finding of proposal.scanFindings) {
      lines.push(`  ${finding.severity} ${finding.ruleId}: ${finding.message}`);
    }
  }
  lines.push("");
  lines.push(...formatChangeDetails(proposal.change));
  lines.push("");
  if (proposal.status === "pending") {
    lines.push("Apply: kova skill-workshop apply <id> --yes");
    lines.push("Reject: kova skill-workshop reject <id>");
  } else if (proposal.status === "quarantined") {
    lines.push("Quarantined proposals cannot be applied. Create a new safe proposal instead.");
    lines.push("Reject: kova skill-workshop reject <id>");
  }
  return lines.join("\n");
}

async function resolveProposal(params: {
  store: SkillWorkshopStore;
  id: string;
  io?: SkillWorkshopCliIo;
}): Promise<SkillProposal> {
  const all = await params.store.list();
  const matches = all.filter(
    (proposal) => proposal.id === params.id || proposal.id.startsWith(params.id),
  );
  if (matches.length === 0) {
    fail(params.io, `Proposal not found: ${params.id}`);
  }
  if (matches.length > 1) {
    fail(params.io, `Proposal id is ambiguous: ${params.id}`);
  }
  return matches[0]!;
}

function assertProposalWorkspace(params: {
  proposal: SkillProposal;
  workspaceDir: string;
  io?: SkillWorkshopCliIo;
}) {
  if (path.resolve(params.proposal.workspaceDir) !== path.resolve(params.workspaceDir)) {
    fail(
      params.io,
      `Refusing to apply proposal for a different workspace: ${params.proposal.workspaceDir}`,
    );
  }
}

async function skillFileExists(workspaceDir: string, skillName: string): Promise<boolean> {
  try {
    await fs.access(path.join(workspaceDir, "skills", skillName, "SKILL.md"));
    return true;
  } catch {
    return false;
  }
}

async function handleStatus(ctx: SkillWorkshopCliContext, opts: CommonOptions) {
  const workspaceDir = resolveWorkspaceDir(ctx, opts);
  const store = createStore(ctx, workspaceDir);
  const proposals = await store.list();
  const counts = Object.fromEntries(
    STATUSES.map((status) => [
      status,
      proposals.filter((proposal) => proposal.status === status).length,
    ]),
  ) as Record<SkillWorkshopStatus, number>;
  if (opts.json) {
    writeLine(ctx.io, "stdout", JSON.stringify({ workspaceDir, ...counts }, null, 2));
    return;
  }
  const config = readPluginConfig(ctx.config);
  writeLine(
    ctx.io,
    "stdout",
    [
      "Skill Workshop Status",
      `Workspace: ${workspaceDir}`,
      `Policy: ${config.approvalPolicy}`,
      "",
      `Pending: ${counts.pending}`,
      `Quarantined: ${counts.quarantined}`,
      `Applied: ${counts.applied}`,
      `Rejected: ${counts.rejected}`,
    ].join("\n"),
  );
}

async function handleList(ctx: SkillWorkshopCliContext, opts: ListOptions) {
  const workspaceDir = resolveWorkspaceDir(ctx, opts);
  const status = parseStatus(opts.status, ctx.io) ?? "pending";
  const store = createStore(ctx, workspaceDir);
  const proposals = await store.list(status);
  if (opts.json) {
    writeLine(ctx.io, "stdout", JSON.stringify({ workspaceDir, status, proposals }, null, 2));
    return;
  }
  writeLine(
    ctx.io,
    "stdout",
    formatProposalList({
      title: `Skill Workshop ${status} proposals`,
      workspaceDir,
      proposals,
      empty: `No ${status} proposals.`,
    }),
  );
}

async function handleReview(ctx: SkillWorkshopCliContext, opts: CommonOptions) {
  const workspaceDir = resolveWorkspaceDir(ctx, opts);
  const store = createStore(ctx, workspaceDir);
  const pending = await store.list("pending");
  const quarantined = await store.list("quarantined");
  if (opts.json) {
    writeLine(ctx.io, "stdout", JSON.stringify({ workspaceDir, pending, quarantined }, null, 2));
    return;
  }
  const lines: string[] = [];
  lines.push(
    formatProposalList({
      title: "Skill Workshop Review",
      workspaceDir,
      proposals: pending,
      empty: "No pending proposals.",
    }),
  );
  lines.push("");
  lines.push(
    formatProposalList({
      title: "Quarantine",
      workspaceDir,
      proposals: quarantined,
      empty: "No quarantined proposals.",
    }),
  );
  lines.push("");
  lines.push("Trust: apply writes only to this workspace's skills directory after --yes.");
  lines.push("Managed skills are not changed by this command.");
  writeLine(ctx.io, "stdout", lines.join("\n"));
}

async function handleInspect(ctx: SkillWorkshopCliContext, id: string, opts: CommonOptions) {
  const workspaceDir = resolveWorkspaceDir(ctx, opts);
  const store = createStore(ctx, workspaceDir);
  const proposal = await resolveProposal({ store, id, io: ctx.io });
  if (opts.json) {
    writeLine(ctx.io, "stdout", JSON.stringify(proposal, null, 2));
    return;
  }
  writeLine(ctx.io, "stdout", formatProposalDetails(proposal));
}

async function handleApply(ctx: SkillWorkshopCliContext, id: string, opts: ApplyOptions) {
  const workspaceDir = resolveWorkspaceDir(ctx, opts);
  const store = createStore(ctx, workspaceDir);
  const proposal = await resolveProposal({ store, id, io: ctx.io });
  assertProposalWorkspace({ proposal, workspaceDir, io: ctx.io });
  if (proposal.status === "quarantined") {
    fail(ctx.io, "Quarantined proposals cannot be applied. Create a new safe proposal instead.");
  }
  if (proposal.status !== "pending") {
    fail(ctx.io, `Only pending proposals can be applied. Current status: ${proposal.status}.`);
  }
  if (!opts.yes) {
    const exists = await skillFileExists(workspaceDir, proposal.skillName);
    writeLine(
      ctx.io,
      "stderr",
      [
        `Review required before applying ${proposal.skillName}.`,
        exists
          ? "Target skill already exists; this proposal may append or replace content."
          : "Target skill does not exist yet; this proposal will create it.",
        "No files changed. Re-run with --yes after inspecting the proposal.",
      ].join("\n"),
    );
    setExitCode(ctx.io, 1);
    return;
  }
  const config = readPluginConfig(ctx.config);
  const applied = await applyProposalToWorkspace({
    proposal,
    maxSkillBytes: config.maxSkillBytes,
  });
  const updated = await store.updateStatus(proposal.id, "applied");
  if (opts.json) {
    writeLine(
      ctx.io,
      "stdout",
      JSON.stringify(
        { status: "applied", skillPath: applied.skillPath, proposal: updated },
        null,
        2,
      ),
    );
    return;
  }
  writeLine(ctx.io, "stdout", `Applied ${proposal.skillName} -> ${applied.skillPath}`);
}

async function handleReject(ctx: SkillWorkshopCliContext, id: string, opts: CommonOptions) {
  const workspaceDir = resolveWorkspaceDir(ctx, opts);
  const store = createStore(ctx, workspaceDir);
  const proposal = await resolveProposal({ store, id, io: ctx.io });
  if (proposal.status === "applied") {
    fail(ctx.io, "Applied proposals cannot be rejected.");
  }
  const updated = await store.updateStatus(proposal.id, "rejected");
  if (opts.json) {
    writeLine(ctx.io, "stdout", JSON.stringify(updated, null, 2));
    return;
  }
  writeLine(ctx.io, "stdout", `Rejected ${proposal.skillName} (${proposal.id})`);
}

function addTargetOptions(command: Command): Command {
  return command
    .option("--agent <id>", "Target agent workspace")
    .option("--workspace <path>", "Target workspace path")
    .option("--json", "Output as JSON", false);
}

export function registerSkillWorkshopCli(program: Command, ctx: SkillWorkshopCliContext) {
  const root = program
    .command("skill-workshop")
    .description("Review Skill Workshop proposals for workspace skills")
    .addHelpText(
      "after",
      "\nExamples:\n  kova skill-workshop review\n  kova skill-workshop inspect <id>\n  kova skill-workshop apply <id> --yes\n",
    );

  addTargetOptions(root.command("status").description("Show proposal counts")).action(
    withCliErrors(ctx, async (opts: CommonOptions) => {
      await handleStatus(ctx, opts);
    }),
  );

  addTargetOptions(
    root.command("review").description("Review pending and quarantined proposals"),
  ).action(
    withCliErrors(ctx, async (opts: CommonOptions) => {
      await handleReview(ctx, opts);
    }),
  );

  addTargetOptions(root.command("list").description("List proposals"))
    .option("--status <status>", "Proposal status: pending, applied, rejected, quarantined")
    .action(
      withCliErrors(ctx, async (opts: ListOptions) => {
        await handleList(ctx, opts);
      }),
    );

  addTargetOptions(root.command("quarantine").description("List quarantined proposals")).action(
    withCliErrors(ctx, async (opts: CommonOptions) => {
      await handleList(ctx, { ...opts, status: "quarantined" });
    }),
  );

  addTargetOptions(root.command("inspect").description("Inspect a proposal"))
    .argument("<id>", "Proposal id or unique prefix")
    .action(
      withCliErrors(ctx, async (id: string, opts: CommonOptions) => {
        await handleInspect(ctx, id, opts);
      }),
    );

  addTargetOptions(root.command("apply").description("Apply a pending workspace proposal"))
    .argument("<id>", "Proposal id or unique prefix")
    .option("--yes", "Confirm the workspace skill write", false)
    .action(
      withCliErrors(ctx, async (id: string, opts: ApplyOptions) => {
        await handleApply(ctx, id, opts);
      }),
    );

  addTargetOptions(root.command("reject").description("Reject a pending or quarantined proposal"))
    .argument("<id>", "Proposal id or unique prefix")
    .action(
      withCliErrors(ctx, async (id: string, opts: CommonOptions) => {
        await handleReject(ctx, id, opts);
      }),
    );

  root.action(
    withCliErrors(ctx, async (opts: CommonOptions) => {
      await handleReview(ctx, opts);
    }),
  );
}
