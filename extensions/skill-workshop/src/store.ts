import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  SkillProposal,
  SkillWorkshopCuratorState,
  SkillWorkshopSkillOrigin,
  SkillWorkshopSkillState,
  SkillWorkshopStatus,
  SkillWorkshopUsageRecord,
} from "./types.js";

type StoreFile = {
  version: 1;
  proposals: SkillProposal[];
  review?: SkillWorkshopReviewState;
  curator?: SkillWorkshopCuratorState;
  usage?: Record<string, SkillWorkshopUsageRecord>;
};

export type SkillWorkshopReviewState = {
  turnsSinceReview: number;
  toolCallsSinceReview: number;
  lastReviewAt?: number;
};

const locks = new Map<string, Promise<void>>();

export function workspaceKey(workspaceDir: string): string {
  return createHash("sha256").update(path.resolve(workspaceDir)).digest("hex").slice(0, 16);
}

async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release: (() => void) | undefined;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    key,
    previous.then(() => next),
  );
  await previous;
  try {
    return await task();
  } finally {
    release?.();
    if (locks.get(key) === next) {
      locks.delete(key);
    }
  }
}

async function readJson(filePath: string): Promise<StoreFile> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    return {
      version: 1,
      proposals: Array.isArray(parsed.proposals) ? parsed.proposals : [],
      review:
        parsed.review && typeof parsed.review === "object"
          ? normalizeReviewState(parsed.review as Partial<SkillWorkshopReviewState>)
          : undefined,
      curator:
        parsed.curator && typeof parsed.curator === "object"
          ? normalizeCuratorState(parsed.curator as Partial<SkillWorkshopCuratorState>)
          : undefined,
      usage: normalizeUsageMap(parsed.usage),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, proposals: [] };
    }
    throw error;
  }
}

function normalizeReviewState(
  value: Partial<SkillWorkshopReviewState> = {},
): SkillWorkshopReviewState {
  return {
    turnsSinceReview:
      typeof value.turnsSinceReview === "number" && Number.isFinite(value.turnsSinceReview)
        ? Math.max(0, Math.trunc(value.turnsSinceReview))
        : 0,
    toolCallsSinceReview:
      typeof value.toolCallsSinceReview === "number" && Number.isFinite(value.toolCallsSinceReview)
        ? Math.max(0, Math.trunc(value.toolCallsSinceReview))
        : 0,
    ...(typeof value.lastReviewAt === "number" && Number.isFinite(value.lastReviewAt)
      ? { lastReviewAt: value.lastReviewAt }
      : {}),
  };
}

function normalizeCuratorState(
  value: Partial<SkillWorkshopCuratorState> = {},
): SkillWorkshopCuratorState {
  return {
    turnsSinceRun:
      typeof value.turnsSinceRun === "number" && Number.isFinite(value.turnsSinceRun)
        ? Math.max(0, Math.trunc(value.turnsSinceRun))
        : 0,
    ...(typeof value.lastRunAt === "number" && Number.isFinite(value.lastRunAt)
      ? { lastRunAt: value.lastRunAt }
      : {}),
    ...(typeof value.lastReportPath === "string" && value.lastReportPath.trim()
      ? { lastReportPath: value.lastReportPath }
      : {}),
  };
}

function normalizeSkillState(value: unknown): SkillWorkshopSkillState {
  return value === "stale" || value === "archived" ? value : "active";
}

function normalizeSkillOrigin(value: unknown): SkillWorkshopSkillOrigin {
  return value === "background" ? "background" : "foreground";
}

function normalizeUsageRecord(value: unknown, skillName: string): SkillWorkshopUsageRecord {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const now = Date.now();
  return {
    skillName,
    origin: normalizeSkillOrigin(record.origin),
    state: normalizeSkillState(record.state),
    createdAt:
      typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
        ? record.createdAt
        : now,
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : now,
    ...(typeof record.firstProposalId === "string" && record.firstProposalId.trim()
      ? { firstProposalId: record.firstProposalId }
      : {}),
    ...(typeof record.lastProposalId === "string" && record.lastProposalId.trim()
      ? { lastProposalId: record.lastProposalId }
      : {}),
    ...(record.lastSource === "agent_end" ||
    record.lastSource === "reviewer" ||
    record.lastSource === "tool"
      ? { lastSource: record.lastSource }
      : {}),
    views:
      typeof record.views === "number" && Number.isFinite(record.views)
        ? Math.max(0, Math.trunc(record.views))
        : 0,
    applies:
      typeof record.applies === "number" && Number.isFinite(record.applies)
        ? Math.max(0, Math.trunc(record.applies))
        : 0,
    patches:
      typeof record.patches === "number" && Number.isFinite(record.patches)
        ? Math.max(0, Math.trunc(record.patches))
        : 0,
    ...(typeof record.lastViewedAt === "number" && Number.isFinite(record.lastViewedAt)
      ? { lastViewedAt: record.lastViewedAt }
      : {}),
    ...(typeof record.lastAppliedAt === "number" && Number.isFinite(record.lastAppliedAt)
      ? { lastAppliedAt: record.lastAppliedAt }
      : {}),
    ...(typeof record.lastPatchedAt === "number" && Number.isFinite(record.lastPatchedAt)
      ? { lastPatchedAt: record.lastPatchedAt }
      : {}),
    ...(record.pinned === true ? { pinned: true } : {}),
    ...(typeof record.archivedAt === "number" && Number.isFinite(record.archivedAt)
      ? { archivedAt: record.archivedAt }
      : {}),
    ...(typeof record.archivePath === "string" && record.archivePath.trim()
      ? { archivePath: record.archivePath }
      : {}),
    ...(typeof record.archiveReason === "string" && record.archiveReason.trim()
      ? { archiveReason: record.archiveReason }
      : {}),
  };
}

function normalizeUsageMap(value: unknown): Record<string, SkillWorkshopUsageRecord> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const usage: Record<string, SkillWorkshopUsageRecord> = {};
  for (const [name, record] of Object.entries(value)) {
    if (!name.trim()) {
      continue;
    }
    usage[name] = normalizeUsageRecord(record, name);
  }
  return usage;
}

function proposalOrigin(source: SkillProposal["source"]): SkillWorkshopSkillOrigin {
  return source === "tool" ? "foreground" : "background";
}

function updateUsageForProposal(
  usage: Record<string, SkillWorkshopUsageRecord>,
  proposal: SkillProposal,
): Record<string, SkillWorkshopUsageRecord> {
  const now = Date.now();
  const existing = usage[proposal.skillName];
  const changeIsPatch = proposal.change.kind === "append" || proposal.change.kind === "replace";
  usage[proposal.skillName] = {
    skillName: proposal.skillName,
    origin: existing?.origin ?? proposalOrigin(proposal.source),
    state: existing?.state === "archived" ? "archived" : "active",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    firstProposalId: existing?.firstProposalId ?? proposal.id,
    lastProposalId: proposal.id,
    lastSource: proposal.source,
    views: existing?.views ?? 0,
    applies: (existing?.applies ?? 0) + 1,
    patches: (existing?.patches ?? 0) + (changeIsPatch ? 1 : 0),
    ...(existing?.lastViewedAt ? { lastViewedAt: existing.lastViewedAt } : {}),
    lastAppliedAt: now,
    ...(changeIsPatch
      ? { lastPatchedAt: now }
      : existing?.lastPatchedAt
        ? { lastPatchedAt: existing.lastPatchedAt }
        : {}),
    ...(existing?.pinned ? { pinned: true } : {}),
    ...(existing?.archivedAt ? { archivedAt: existing.archivedAt } : {}),
    ...(existing?.archivePath ? { archivePath: existing.archivePath } : {}),
    ...(existing?.archiveReason ? { archiveReason: existing.archiveReason } : {}),
  };
  return usage;
}

async function atomicWriteJson(filePath: string, data: StoreFile): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now().toString(36)}-${randomUUID()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

export class SkillWorkshopStore {
  readonly filePath: string;

  constructor(params: { stateDir: string; workspaceDir: string }) {
    this.filePath = path.join(
      params.stateDir,
      "skill-workshop",
      `${workspaceKey(params.workspaceDir)}.json`,
    );
  }

  async list(status?: SkillWorkshopStatus): Promise<SkillProposal[]> {
    const file = await readJson(this.filePath);
    const proposals = status
      ? file.proposals.filter((proposal) => proposal.status === status)
      : file.proposals;
    return proposals.toSorted((left, right) => right.createdAt - left.createdAt);
  }

  async get(id: string): Promise<SkillProposal | undefined> {
    return (await this.list()).find((proposal) => proposal.id === id);
  }

  async add(proposal: SkillProposal, maxPending: number): Promise<SkillProposal> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const duplicate = file.proposals.find(
        (item) =>
          (item.status === "pending" || item.status === "quarantined") &&
          item.skillName === proposal.skillName &&
          JSON.stringify(item.change) === JSON.stringify(proposal.change),
      );
      if (duplicate) {
        return duplicate;
      }
      const nextProposals = [proposal, ...file.proposals].filter((item, index, all) => {
        if (item.status !== "pending" && item.status !== "quarantined") {
          return true;
        }
        return (
          all
            .slice(0, index + 1)
            .filter(
              (candidate) => candidate.status === "pending" || candidate.status === "quarantined",
            ).length <= maxPending
        );
      });
      await atomicWriteJson(this.filePath, { ...file, version: 1, proposals: nextProposals });
      return proposal;
    });
  }

  async updateStatus(id: string, status: SkillWorkshopStatus): Promise<SkillProposal> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const index = file.proposals.findIndex((proposal) => proposal.id === id);
      if (index < 0) {
        throw new Error(`proposal not found: ${id}`);
      }
      const updated = { ...file.proposals[index], status, updatedAt: Date.now() };
      file.proposals[index] = updated;
      await atomicWriteJson(this.filePath, file);
      return updated;
    });
  }

  async recordAppliedProposal(proposal: SkillProposal): Promise<SkillWorkshopUsageRecord> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const usage = updateUsageForProposal({ ...(file.usage ?? {}) }, proposal);
      await atomicWriteJson(this.filePath, { ...file, usage });
      return usage[proposal.skillName]!;
    });
  }

  async listUsage(state?: SkillWorkshopSkillState): Promise<SkillWorkshopUsageRecord[]> {
    const file = await readJson(this.filePath);
    const records = Object.values(file.usage ?? {});
    return records
      .filter((record) => (state ? record.state === state : true))
      .toSorted((left, right) => right.updatedAt - left.updatedAt);
  }

  async getUsage(skillName: string): Promise<SkillWorkshopUsageRecord | undefined> {
    const file = await readJson(this.filePath);
    return file.usage?.[skillName];
  }

  async markUsageViewed(skillName: string): Promise<SkillWorkshopUsageRecord> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const usage = { ...(file.usage ?? {}) };
      const existing = usage[skillName];
      const now = Date.now();
      usage[skillName] = {
        skillName,
        origin: existing?.origin ?? "foreground",
        state: existing?.state ?? "active",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(existing?.firstProposalId ? { firstProposalId: existing.firstProposalId } : {}),
        ...(existing?.lastProposalId ? { lastProposalId: existing.lastProposalId } : {}),
        ...(existing?.lastSource ? { lastSource: existing.lastSource } : {}),
        views: (existing?.views ?? 0) + 1,
        applies: existing?.applies ?? 0,
        patches: existing?.patches ?? 0,
        lastViewedAt: now,
        ...(existing?.lastAppliedAt ? { lastAppliedAt: existing.lastAppliedAt } : {}),
        ...(existing?.lastPatchedAt ? { lastPatchedAt: existing.lastPatchedAt } : {}),
        ...(existing?.pinned ? { pinned: true } : {}),
        ...(existing?.archivedAt ? { archivedAt: existing.archivedAt } : {}),
        ...(existing?.archivePath ? { archivePath: existing.archivePath } : {}),
        ...(existing?.archiveReason ? { archiveReason: existing.archiveReason } : {}),
      };
      await atomicWriteJson(this.filePath, { ...file, usage });
      return usage[skillName]!;
    });
  }

  async setUsagePinned(skillName: string, pinned: boolean): Promise<SkillWorkshopUsageRecord> {
    return await this.updateUsage(skillName, (record, now) => {
      if (pinned) {
        return { ...record, updatedAt: now, pinned: true };
      }
      const { pinned: _pinned, ...rest } = record;
      return { ...rest, updatedAt: now };
    });
  }

  async setUsageState(params: {
    skillName: string;
    state: SkillWorkshopSkillState;
    archivePath?: string;
    archiveReason?: string;
  }): Promise<SkillWorkshopUsageRecord> {
    return await this.updateUsage(params.skillName, (record, now) => {
      const base = {
        ...record,
        state: params.state,
        updatedAt: now,
      };
      if (params.state !== "archived") {
        const {
          archivedAt: _archivedAt,
          archivePath: _archivePath,
          archiveReason: _archiveReason,
          ...rest
        } = base;
        return rest;
      }
      return {
        ...base,
        archivedAt: now,
        ...(params.archivePath ? { archivePath: params.archivePath } : {}),
        ...(params.archiveReason ? { archiveReason: params.archiveReason } : {}),
      };
    });
  }

  private async updateUsage(
    skillName: string,
    update: (record: SkillWorkshopUsageRecord, now: number) => SkillWorkshopUsageRecord,
  ): Promise<SkillWorkshopUsageRecord> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const usage = { ...(file.usage ?? {}) };
      const now = Date.now();
      const current =
        usage[skillName] ??
        normalizeUsageRecord(
          {
            skillName,
            origin: "foreground",
            state: "active",
            createdAt: now,
            updatedAt: now,
            views: 0,
            applies: 0,
            patches: 0,
          },
          skillName,
        );
      const next = update(current, now);
      usage[skillName] = normalizeUsageRecord(next, skillName);
      await atomicWriteJson(this.filePath, { ...file, usage });
      return usage[skillName]!;
    });
  }

  async recordReviewTurn(toolCalls: number): Promise<SkillWorkshopReviewState> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const current = normalizeReviewState(file.review);
      const next = {
        ...current,
        turnsSinceReview: current.turnsSinceReview + 1,
        toolCallsSinceReview: current.toolCallsSinceReview + Math.max(0, Math.trunc(toolCalls)),
      };
      await atomicWriteJson(this.filePath, { ...file, review: next });
      return next;
    });
  }

  async markReviewed(): Promise<SkillWorkshopReviewState> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const next = {
        turnsSinceReview: 0,
        toolCallsSinceReview: 0,
        lastReviewAt: Date.now(),
      };
      await atomicWriteJson(this.filePath, { ...file, review: next });
      return next;
    });
  }

  async recordCuratorTurn(): Promise<SkillWorkshopCuratorState> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const current = normalizeCuratorState(file.curator);
      const next = {
        ...current,
        turnsSinceRun: current.turnsSinceRun + 1,
      };
      await atomicWriteJson(this.filePath, { ...file, curator: next });
      return next;
    });
  }

  async markCuratorRun(reportPath?: string): Promise<SkillWorkshopCuratorState> {
    return await withLock(this.filePath, async () => {
      const file = await readJson(this.filePath);
      const next = {
        turnsSinceRun: 0,
        lastRunAt: Date.now(),
        ...(reportPath ? { lastReportPath: reportPath } : {}),
      };
      await atomicWriteJson(this.filePath, { ...file, curator: next });
      return next;
    });
  }
}
