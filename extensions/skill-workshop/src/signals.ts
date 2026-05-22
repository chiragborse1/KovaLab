import { randomUUID } from "node:crypto";
import { compactWhitespace, extractTranscriptText } from "./text.js";
import type { SkillProposal } from "./types.js";

const CORRECTION_PATTERNS = [
  /\bnext time\b/i,
  /\bfrom now on\b/i,
  /\bremember to\b/i,
  /\bmake sure to\b/i,
  /\balways\b.{0,80}\b(use|check|verify|record|save|prefer)\b/i,
  /\bprefer\b.{0,120}\b(when|for|instead|use)\b/i,
  /\bwhen asked\b/i,
  /\b(do not|don't|never)\b.{0,120}\b(repeat|do that again|skip|forget|assume|ship)\b/i,
  /\bavoid\b.{0,120}\b(doing|using|running|adding|changing|repeating)\b/i,
  /\bthis\b.{0,40}\b(was wrong|was incorrect|is wrong|is incorrect)\b/i,
];

const REPAIR_CONTEXT_PATTERNS = [
  /\broot cause\b/i,
  /\b(the )?(issue|bug|regression|failure|error)\b.{0,80}\b(was|came from|happened because)\b/i,
  /\b(fixed|resolved|repaired|unblocked)\b.{0,160}\b(by|with|after|because)\b/i,
  /\b(added|ran|created)\b.{0,80}\b(regression test|focused test|proof|verification)\b/i,
  /\bnext time\b.{0,160}\b(check|verify|inspect|avoid|reproduce)\b/i,
];

const REPAIR_PROBLEM_PATTERN =
  /\b(root cause|bug|regression|failed|failure|error|broken|mistake|wrong|timeout|rate limit|cooldown|hang|freeze|lag)\b/i;

const REPAIR_RESOLUTION_PATTERN =
  /\b(fixed|resolved|repaired|unblocked|verified|added .{0,40}test|ran .{0,40}test|next time|avoid|do not repeat|don't repeat)\b/i;

const RELEVANT_SENTENCE_SPLIT = /(?<=[.!?])\s+|\n+/u;

type CapturedInstruction = {
  text: string;
  kind: "correction" | "repair";
  reason: string;
};

type TranscriptEntry = ReturnType<typeof extractTranscriptText>[number];

function selectRelevantRepairText(text: string): string {
  const sentences = text.split(RELEVANT_SENTENCE_SPLIT).map(compactWhitespace).filter(Boolean);
  const relevant = sentences.filter((sentence) =>
    REPAIR_CONTEXT_PATTERNS.some((pattern) => pattern.test(sentence)),
  );
  const selected = (relevant.length > 0 ? relevant : sentences).slice(-3).join(" ");
  return compactWhitespace(selected).slice(0, 900);
}

function isUsefulCandidate(text: string, minLength = 24, maxLength = 1600): boolean {
  const length = compactWhitespace(text).length;
  return length >= minLength && length <= maxLength;
}

function inferTopic(text: string): { skillName: string; title: string; label: string } {
  const lower = text.toLowerCase();
  if (
    /\btui\b|\bterminal\b|\bstartup\b|\bfirst[- ]?token\b|\blatency\b|\bslow\b|\blag\b|\bfreez/.test(
      lower,
    )
  ) {
    return {
      skillName: "terminal-runtime-workflow",
      title: "Terminal Runtime Workflow",
      label: "terminal runtime fixes",
    };
  }
  if (
    /\bprovider\b|\brate limit\b|\bcooldown\b|\bfallback\b|\bauth profile\b|\bmodel\b/.test(lower)
  ) {
    return {
      skillName: "provider-failover-workflow",
      title: "Provider Failover Workflow",
      label: "provider and model failover work",
    };
  }
  if (/\bmemory\b|\bskill\b|\bcurator\b|\blearn(ed|ing)?\b/.test(lower)) {
    return {
      skillName: "procedural-memory-workflow",
      title: "Procedural Memory Workflow",
      label: "memory and skill learning",
    };
  }
  if (/\bsubagent\b|\bdelegat(e|ion)\b|\bbackground task\b|\bparallel\b/.test(lower)) {
    return {
      skillName: "delegation-workflow",
      title: "Delegation Workflow",
      label: "delegation and background work",
    };
  }
  if (/\brollback\b|\bcheckpoint\b|\brecover\b|\brestore\b/.test(lower)) {
    return {
      skillName: "rollback-recovery-workflow",
      title: "Rollback Recovery Workflow",
      label: "rollback and recovery work",
    };
  }
  if (/\banimated\b|\bgifs?\b/.test(lower)) {
    return {
      skillName: "animated-gif-workflow",
      title: "Animated GIF Workflow",
      label: "animated GIF requests",
    };
  }
  if (/\bscreenshot|screen capture|imageoptim|asset\b/.test(lower)) {
    return {
      skillName: "screenshot-asset-workflow",
      title: "Screenshot Asset Workflow",
      label: "screenshot asset updates",
    };
  }
  if (/\bqa\b|\bscenario\b|\btest plan\b/.test(lower)) {
    return { skillName: "qa-scenario-workflow", title: "QA Scenario Workflow", label: "QA tasks" };
  }
  if (/\bpr\b|\bpull request\b|\bgithub\b/.test(lower)) {
    return {
      skillName: "github-pr-workflow",
      title: "GitHub PR Workflow",
      label: "GitHub PR work",
    };
  }
  return { skillName: "learned-workflows", title: "Learned Workflows", label: "repeatable tasks" };
}

function extractCorrectionInstruction(text: string): CapturedInstruction | undefined {
  const trimmed = compactWhitespace(text);
  if (!isUsefulCandidate(trimmed, 24, 1200)) {
    return undefined;
  }
  if (!CORRECTION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  return {
    text: trimmed.replace(/^ok[,. ]+/i, ""),
    kind: "correction",
    reason: "User correction",
  };
}

function extractRepairInstruction(transcript: TranscriptEntry[]): CapturedInstruction | undefined {
  const recent = transcript.slice(-8);
  const recentText = compactWhitespace(recent.map((entry) => entry.text).join("\n"));
  if (!isUsefulCandidate(recentText, 80, 2600)) {
    return undefined;
  }
  if (!REPAIR_PROBLEM_PATTERN.test(recentText) || !REPAIR_RESOLUTION_PATTERN.test(recentText)) {
    return undefined;
  }
  if (!REPAIR_CONTEXT_PATTERNS.some((pattern) => pattern.test(recentText))) {
    return undefined;
  }
  const selected = selectRelevantRepairText(recentText);
  if (!isUsefulCandidate(selected, 40, 900)) {
    return undefined;
  }
  return {
    text: selected,
    kind: "repair",
    reason: "Resolved failure pattern",
  };
}

function renderProposalBody(topic: ReturnType<typeof inferTopic>, capture: CapturedInstruction) {
  if (capture.kind === "repair") {
    return [
      `# ${topic.title}`,
      "",
      "## Workflow",
      "",
      "- Reproduce or inspect the failure before editing.",
      "- Name the root cause before choosing the fix.",
      `- Learned repair signal: ${capture.text}`,
      "- Add or run the focused proof that would catch the same failure again.",
      "- Keep the final reply short: what changed, proof run, and any remaining risk.",
    ].join("\n");
  }
  return [
    `# ${topic.title}`,
    "",
    "## Workflow",
    "",
    `- ${capture.text}`,
    "- Verify the result before final reply.",
    "- Record durable pitfalls as short bullets; avoid copying transcript noise.",
  ].join("\n");
}

export function createProposalFromMessages(params: {
  messages: unknown[];
  workspaceDir: string;
  agentId?: string;
  sessionId?: string;
}): SkillProposal | undefined {
  const transcript = extractTranscriptText(params.messages);
  const userTexts = transcript.filter((entry) => entry.role === "user").map((entry) => entry.text);
  const capture =
    userTexts.map(extractCorrectionInstruction).findLast(Boolean) ??
    extractRepairInstruction(transcript);
  if (!capture) {
    return undefined;
  }
  const topic = inferTopic(capture.text);
  const now = Date.now();
  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    workspaceDir: params.workspaceDir,
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    skillName: topic.skillName,
    title: topic.title,
    reason: `${capture.reason} for ${topic.label}`,
    source: "agent_end",
    status: "pending",
    change: {
      kind: "create",
      description: `Reusable workflow notes for ${topic.label}.`,
      body: renderProposalBody(topic, capture),
    },
  };
}
