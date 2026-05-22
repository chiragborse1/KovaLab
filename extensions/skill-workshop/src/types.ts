export type SkillWorkshopStatus = "pending" | "applied" | "rejected" | "quarantined";

export type SkillWorkshopSkillState = "active" | "stale" | "archived";

export type SkillWorkshopSkillOrigin = "foreground" | "background";

export type SkillChange =
  | {
      kind: "create";
      description: string;
      body: string;
    }
  | {
      kind: "append";
      section: string;
      body: string;
      description?: string;
    }
  | {
      kind: "replace";
      oldText: string;
      newText: string;
    };

export type SkillProposal = {
  id: string;
  createdAt: number;
  updatedAt: number;
  workspaceDir: string;
  agentId?: string;
  sessionId?: string;
  skillName: string;
  title: string;
  reason: string;
  source: "agent_end" | "reviewer" | "tool";
  status: SkillWorkshopStatus;
  change: SkillChange;
  scanFindings?: SkillScanFinding[];
  quarantineReason?: string;
};

export type SkillScanFinding = {
  severity: "info" | "warn" | "critical";
  ruleId: string;
  message: string;
};

export type SkillWorkshopUsageRecord = {
  skillName: string;
  origin: SkillWorkshopSkillOrigin;
  state: SkillWorkshopSkillState;
  createdAt: number;
  updatedAt: number;
  firstProposalId?: string;
  lastProposalId?: string;
  lastSource?: SkillProposal["source"];
  views: number;
  applies: number;
  patches: number;
  lastViewedAt?: number;
  lastAppliedAt?: number;
  lastPatchedAt?: number;
  pinned?: boolean;
  archivedAt?: number;
  archivePath?: string;
  archiveReason?: string;
};

export type SkillWorkshopCuratorState = {
  turnsSinceRun: number;
  lastRunAt?: number;
  lastReportPath?: string;
};

export type SkillWorkshopCuratorAction =
  | {
      type: "mark_stale";
      skillName: string;
      reason: string;
      previousState?: SkillWorkshopSkillState;
    }
  | {
      type: "archive";
      skillName: string;
      reason: string;
      previousState?: SkillWorkshopSkillState;
      archivePath?: string;
    }
  | {
      type: "keep";
      skillName: string;
      reason: string;
    };

export type SkillWorkshopCuratorReport = {
  id: string;
  createdAt: number;
  workspaceDir: string;
  apply: boolean;
  checked: number;
  actions: SkillWorkshopCuratorAction[];
  skipped: Array<{ skillName: string; reason: string }>;
};
