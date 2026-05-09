import type { TaskTemplate } from "./types.ts";

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "daily-briefing",
    icon: "🌅",
    name: "Daily Briefing",
    description: "Summarize recent sessions and messages every morning",
    defaultTitle: "Daily briefing",
    defaultNotes: "Summarize recent sessions, messages, costs, and any blocked tasks.",
  },
  {
    id: "inbox-triage",
    icon: "📥",
    name: "Inbox Triage",
    description: "Review and categorize incoming channel messages",
    defaultTitle: "Inbox triage",
    defaultNotes: "Review new channel messages, group them by priority, and suggest replies.",
  },
  {
    id: "memory-consolidation",
    icon: "🧠",
    name: "Memory Consolidation",
    description: "Compress and organize agent memory files",
    defaultTitle: "Memory consolidation",
    defaultNotes: "Review memory files, consolidate duplicate notes, and summarize durable facts.",
  },
  {
    id: "weekly-summary",
    icon: "📋",
    name: "Weekly Summary",
    description: "Generate a weekly activity and cost report",
    defaultTitle: "Weekly activity summary",
    defaultNotes: "Create a weekly summary covering sessions, jobs, costs, and failed tasks.",
  },
  {
    id: "code-review",
    icon: "🔍",
    name: "Code Review",
    description: "Review recent code changes in the workspace",
    defaultTitle: "Review recent code changes",
    defaultNotes: "Inspect recent git changes and report bugs, regressions, and missing tests.",
  },
  {
    id: "custom",
    icon: "⚡",
    name: "Custom",
    description: "Start from scratch",
    defaultTitle: "",
    defaultNotes: "",
  },
];
