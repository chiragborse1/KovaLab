import type { GatewayBrowserClient } from "../../gateway.ts";
import type {
  AgentIdentityResult,
  GatewaySessionRow,
  SessionCompactionCheckpoint,
  SessionsListResult,
} from "../../types.ts";

export type SessionSource = "direct" | "telegram" | "discord" | "cron" | "other";

export type SessionStatus = "active" | "idle" | "unknown";

export type OverrideValue = "inherit" | "on" | "off" | "Default (off)" | (string & {});

export type SessionOverrides = {
  thinking: OverrideValue;
  fast: OverrideValue;
  verbose: OverrideValue;
  reasoning: OverrideValue;
  compaction: string | null;
};

export type Session = {
  key: string;
  label: string | null;
  kind: string;
  updatedAt: string;
  updatedAtMs: number | null;
  tokens: string;
  overrides: SessionOverrides;
  row: GatewaySessionRow;
  displayTitle: string;
  source: SessionSource;
  status: SessionStatus;
  tokensUsed: number | null;
  tokenLimit: number | null;
  tokenPercent: number | null;
  agentId: string | null;
};

export type SessionGroup = {
  source: SessionSource;
  label: string;
  sessions: Session[];
  collapsed: boolean;
};

export type SessionFilterSource = "all" | SessionSource;
export type SessionFilterTime = "today" | "week" | "all";
export type SessionDetailTab = "overview" | "conversation" | "checkpoints";

export type SessionConversationMessage = {
  role: "user" | "assistant" | "system" | "tool" | "unknown";
  text: string;
  toolName?: string;
};

export type SessionsProps = {
  client?: GatewayBrowserClient | null;
  connected?: boolean;
  loading: boolean;
  result: SessionsListResult | null;
  error: string | null;
  activeMinutes: string;
  limit: string;
  includeGlobal: boolean;
  includeUnknown: boolean;
  basePath: string;
  searchQuery: string;
  agentIdentityById: Record<string, AgentIdentityResult>;
  sortColumn: "key" | "kind" | "updated" | "tokens";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
  selectedKeys: Set<string>;
  expandedCheckpointKey: string | null;
  checkpointItemsByKey: Record<string, SessionCompactionCheckpoint[]>;
  checkpointLoadingKey: string | null;
  checkpointBusyKey: string | null;
  checkpointErrorByKey: Record<string, string>;
  onFiltersChange: (next: {
    activeMinutes: string;
    limit: string;
    includeGlobal: boolean;
    includeUnknown: boolean;
  }) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (column: "key" | "kind" | "updated" | "tokens", dir: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh: () => void;
  onPatch: (
    key: string,
    patch: {
      label?: string | null;
      thinkingLevel?: string | null;
      fastMode?: boolean | null;
      verboseLevel?: string | null;
      reasoningLevel?: string | null;
    },
  ) => void;
  onToggleSelect: (key: string) => void;
  onSelectPage: (keys: string[]) => void;
  onDeselectPage: (keys: string[]) => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onDeleteSession?: (key: string) => void | Promise<void>;
  onNavigateToChat?: (sessionKey: string) => void;
  onToggleCheckpointDetails: (sessionKey: string) => void;
  onBranchFromCheckpoint: (sessionKey: string, checkpointId: string) => void | Promise<void>;
  onRestoreCheckpoint: (sessionKey: string, checkpointId: string) => void | Promise<void>;
};
