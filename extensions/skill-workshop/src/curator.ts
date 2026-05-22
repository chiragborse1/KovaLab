import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { bumpSkillsSnapshotVersion } from "../api.js";
import { workspaceKey, SkillWorkshopStore } from "./store.js";
import type {
  SkillWorkshopCuratorAction,
  SkillWorkshopCuratorReport,
  SkillWorkshopSkillState,
  SkillWorkshopUsageRecord,
} from "./types.js";

export type SkillWorkshopCuratorConfig = {
  enabled: boolean;
  intervalTurns: number;
  minSkillAgeDays: number;
  staleDays: number;
  archiveDays: number;
  maxActions: number;
};

export type SkillWorkshopCuratorRollbackResult = {
  reportPath: string;
  workspaceDir: string;
  rolledBack: Array<{ type: string; skillName: string; state?: SkillWorkshopSkillState }>;
  skipped: Array<{ skillName: string; reason: string }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ageDays(timestamp: number | undefined, now: number): number {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return 0;
  }
  return Math.max(0, (now - timestamp) / DAY_MS);
}

function lastActivityAt(record: SkillWorkshopUsageRecord): number {
  return Math.max(
    record.lastViewedAt ?? 0,
    record.lastAppliedAt ?? 0,
    record.lastPatchedAt ?? 0,
    record.updatedAt,
  );
}

function isManagedByCurator(record: SkillWorkshopUsageRecord): boolean {
  return record.origin === "background" && record.pinned !== true && record.state !== "archived";
}

function reportDir(params: { stateDir: string; workspaceDir: string }): string {
  return path.join(params.stateDir, "skill-workshop", "reports", workspaceKey(params.workspaceDir));
}

function stateDirForStore(store: SkillWorkshopStore): string {
  return path.dirname(path.dirname(store.filePath));
}

function assertPathInside(params: { root: string; candidate: string; label: string }): string {
  const root = path.resolve(params.root);
  const candidate = path.resolve(params.candidate);
  if (candidate === root || candidate.startsWith(`${root}${path.sep}`)) {
    return candidate;
  }
  throw new Error(`${params.label} escapes expected directory`);
}

async function assertExistingPathInside(params: {
  root: string;
  candidate: string;
  label: string;
}): Promise<string> {
  await fs.mkdir(params.root, { recursive: true });
  const [rootReal, candidateReal] = await Promise.all([
    fs.realpath(params.root),
    fs.realpath(params.candidate),
  ]);
  if (candidateReal === rootReal || candidateReal.startsWith(`${rootReal}${path.sep}`)) {
    return candidateReal;
  }
  throw new Error(`${params.label} escapes expected directory`);
}

function reportMarkdown(report: SkillWorkshopCuratorReport): string {
  const lines: string[] = [];
  lines.push(`# Skill Workshop Curator Report`);
  lines.push("");
  lines.push(`Workspace: ${report.workspaceDir}`);
  lines.push(`Mode: ${report.apply ? "apply" : "preview"}`);
  lines.push(`Checked: ${String(report.checked)}`);
  lines.push("");
  if (report.actions.length === 0) {
    lines.push("No actions.");
  } else {
    lines.push("## Actions");
    for (const action of report.actions) {
      const suffix =
        action.type === "archive" && action.archivePath ? ` -> ${action.archivePath}` : "";
      lines.push(`- ${action.type}: ${action.skillName} - ${action.reason}${suffix}`);
    }
  }
  if (report.skipped.length > 0) {
    lines.push("");
    lines.push("## Skipped");
    for (const item of report.skipped) {
      lines.push(`- ${item.skillName}: ${item.reason}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensurePlainDirectory(dirPath: string): Promise<void> {
  const stat = await fs.lstat(dirPath);
  if (stat.isSymbolicLink()) {
    throw new Error("skill directory must not be a symlink");
  }
  if (!stat.isDirectory()) {
    throw new Error("skill path is not a directory");
  }
}

async function archiveSkillDirectory(params: {
  workspaceDir: string;
  skillName: string;
  now: number;
}): Promise<string | undefined> {
  const skillsDir = path.resolve(params.workspaceDir, "skills");
  const source = path.resolve(skillsDir, params.skillName);
  if (source === skillsDir || !source.startsWith(`${skillsDir}${path.sep}`)) {
    throw new Error("skill archive source escapes workspace skills directory");
  }
  if (!(await pathExists(path.join(source, "SKILL.md")))) {
    return undefined;
  }
  await ensurePlainDirectory(source);
  const archiveRoot = path.join(skillsDir, ".archive");
  await fs.mkdir(archiveRoot, { recursive: true });
  await ensurePlainDirectory(archiveRoot);
  const stamp = new Date(params.now).toISOString().replace(/[:.]/g, "-");
  const target = assertPathInside({
    root: archiveRoot,
    candidate: path.join(archiveRoot, `${params.skillName}-${stamp}`),
    label: "skill archive target",
  });
  await fs.rename(source, target);
  bumpSkillsSnapshotVersion({
    workspaceDir: params.workspaceDir,
    reason: "manual",
    changedPath: source,
  });
  return target;
}

export async function archiveSkill(params: {
  store: SkillWorkshopStore;
  workspaceDir: string;
  skillName: string;
  reason: string;
  now?: number;
}): Promise<string | undefined> {
  const now = params.now ?? Date.now();
  const archivePath = await archiveSkillDirectory({
    workspaceDir: params.workspaceDir,
    skillName: params.skillName,
    now,
  });
  await params.store.setUsageState({
    skillName: params.skillName,
    state: "archived",
    ...(archivePath ? { archivePath } : {}),
    archiveReason: params.reason,
  });
  return archivePath;
}

export async function restoreArchivedSkill(params: {
  store: SkillWorkshopStore;
  workspaceDir: string;
  skillName: string;
}): Promise<string> {
  const record = await params.store.getUsage(params.skillName);
  if (!record?.archivePath) {
    throw new Error(`archive path not found for ${params.skillName}`);
  }
  const skillsDir = path.resolve(params.workspaceDir, "skills");
  const target = path.resolve(skillsDir, params.skillName);
  if (target === skillsDir || !target.startsWith(`${skillsDir}${path.sep}`)) {
    throw new Error("skill restore target escapes workspace skills directory");
  }
  if (await pathExists(target)) {
    throw new Error(`skill already exists: ${params.skillName}`);
  }
  await fs.mkdir(skillsDir, { recursive: true });
  const archiveRoot = path.join(skillsDir, ".archive");
  await fs.mkdir(archiveRoot, { recursive: true });
  await ensurePlainDirectory(archiveRoot);
  const source = await assertExistingPathInside({
    root: archiveRoot,
    candidate: record.archivePath,
    label: "skill archive path",
  });
  await ensurePlainDirectory(source);
  await fs.rename(source, target);
  await params.store.setUsageState({ skillName: params.skillName, state: "active" });
  bumpSkillsSnapshotVersion({
    workspaceDir: params.workspaceDir,
    reason: "manual",
    changedPath: target,
  });
  return target;
}

export async function runSkillCurator(params: {
  store: SkillWorkshopStore;
  stateDir: string;
  workspaceDir: string;
  config: SkillWorkshopCuratorConfig;
  apply: boolean;
  now?: number;
}): Promise<{ report: SkillWorkshopCuratorReport; reportPath: string }> {
  const now = params.now ?? Date.now();
  const usage = await params.store.listUsage();
  const actions: SkillWorkshopCuratorAction[] = [];
  const skipped: SkillWorkshopCuratorReport["skipped"] = [];

  for (const record of usage) {
    if (actions.length >= params.config.maxActions) {
      skipped.push({ skillName: record.skillName, reason: "max actions reached" });
      continue;
    }
    if (record.pinned) {
      skipped.push({ skillName: record.skillName, reason: "pinned" });
      continue;
    }
    if (record.state === "archived") {
      skipped.push({ skillName: record.skillName, reason: "already archived" });
      continue;
    }
    if (!isManagedByCurator(record)) {
      skipped.push({ skillName: record.skillName, reason: "foreground skill" });
      continue;
    }

    const skillAge = ageDays(record.createdAt, now);
    const idleAge = ageDays(lastActivityAt(record), now);
    if (skillAge < params.config.minSkillAgeDays) {
      skipped.push({ skillName: record.skillName, reason: "too new" });
      continue;
    }
    if (idleAge >= params.config.archiveDays) {
      const reason = `inactive for ${Math.floor(idleAge)} days`;
      const action: SkillWorkshopCuratorAction = {
        type: "archive",
        skillName: record.skillName,
        reason,
        previousState: record.state,
      };
      if (params.apply) {
        const archivePath = await archiveSkill({
          store: params.store,
          workspaceDir: params.workspaceDir,
          skillName: record.skillName,
          reason,
          now,
        });
        actions.push({ ...action, ...(archivePath ? { archivePath } : {}) });
      } else {
        actions.push(action);
      }
      continue;
    }
    if (idleAge >= params.config.staleDays) {
      const reason = `inactive for ${Math.floor(idleAge)} days`;
      if (params.apply) {
        await params.store.setUsageState({
          skillName: record.skillName,
          state: "stale",
          archiveReason: reason,
        });
      }
      actions.push({
        type: "mark_stale",
        skillName: record.skillName,
        reason,
        previousState: record.state,
      });
      continue;
    }
    actions.push({ type: "keep", skillName: record.skillName, reason: "recent activity" });
  }

  const report: SkillWorkshopCuratorReport = {
    id: randomUUID(),
    createdAt: now,
    workspaceDir: params.workspaceDir,
    apply: params.apply,
    checked: usage.length,
    actions,
    skipped,
  };
  const dir = reportDir({ stateDir: params.stateDir, workspaceDir: params.workspaceDir });
  await fs.mkdir(dir, { recursive: true });
  const basename = `${new Date(now).toISOString().replace(/[:.]/g, "-")}-${report.id}`;
  const jsonPath = path.join(dir, `${basename}.json`);
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(dir, `${basename}.md`), reportMarkdown(report), "utf8");
  await params.store.markCuratorRun(jsonPath);
  return { report, reportPath: jsonPath };
}

async function readCuratorReport(reportPath: string): Promise<SkillWorkshopCuratorReport> {
  const parsed = JSON.parse(
    await fs.readFile(reportPath, "utf8"),
  ) as Partial<SkillWorkshopCuratorReport>;
  if (!parsed.workspaceDir || !Array.isArray(parsed.actions)) {
    throw new Error(`invalid curator report: ${reportPath}`);
  }
  return {
    id: typeof parsed.id === "string" ? parsed.id : "unknown",
    createdAt:
      typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt)
        ? parsed.createdAt
        : 0,
    workspaceDir: parsed.workspaceDir,
    apply: parsed.apply === true,
    checked:
      typeof parsed.checked === "number" && Number.isFinite(parsed.checked) ? parsed.checked : 0,
    actions: parsed.actions,
    skipped: Array.isArray(parsed.skipped) ? parsed.skipped : [],
  };
}

export async function rollbackSkillCuratorReport(params: {
  store: SkillWorkshopStore;
  workspaceDir: string;
  reportPath?: string;
}): Promise<SkillWorkshopCuratorRollbackResult> {
  const curator = await params.store.getCuratorState();
  const reportPath = params.reportPath ?? curator.lastReportPath;
  if (!reportPath) {
    throw new Error("curator report path required");
  }
  const safeReportPath = await assertExistingPathInside({
    root: reportDir({
      stateDir: stateDirForStore(params.store),
      workspaceDir: params.workspaceDir,
    }),
    candidate: reportPath,
    label: "curator report path",
  });
  const report = await readCuratorReport(safeReportPath);
  if (path.resolve(report.workspaceDir) !== path.resolve(params.workspaceDir)) {
    throw new Error("curator report belongs to a different workspace");
  }
  const rolledBack: SkillWorkshopCuratorRollbackResult["rolledBack"] = [];
  const skipped: SkillWorkshopCuratorRollbackResult["skipped"] = [];
  if (!report.apply) {
    return { reportPath: safeReportPath, workspaceDir: params.workspaceDir, rolledBack, skipped };
  }
  for (const action of report.actions.toReversed()) {
    if (action.type === "keep") {
      continue;
    }
    if (!action.previousState) {
      skipped.push({ skillName: action.skillName, reason: "missing previous state" });
      continue;
    }
    if (action.type === "mark_stale") {
      await params.store.setUsageState({
        skillName: action.skillName,
        state: action.previousState,
      });
      rolledBack.push({
        type: action.type,
        skillName: action.skillName,
        state: action.previousState,
      });
      continue;
    }
    if (action.type === "archive") {
      await restoreArchivedSkill({
        store: params.store,
        workspaceDir: params.workspaceDir,
        skillName: action.skillName,
      });
      if (action.previousState !== "active") {
        await params.store.setUsageState({
          skillName: action.skillName,
          state: action.previousState,
        });
      }
      rolledBack.push({
        type: action.type,
        skillName: action.skillName,
        state: action.previousState,
      });
    }
  }
  return { reportPath: safeReportPath, workspaceDir: params.workspaceDir, rolledBack, skipped };
}

export function shouldRunCurator(params: {
  enabled: boolean;
  turnsSinceRun: number;
  intervalTurns: number;
}): boolean {
  return params.enabled && params.turnsSinceRun >= params.intervalTurns;
}
