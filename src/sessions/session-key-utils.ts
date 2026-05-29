import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";

export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

export type ParsedThreadSessionSuffix = {
  baseSessionKey: string | undefined;
  threadId: string | undefined;
};

export type RawSessionConversationRef = {
  channel: string;
  kind: "group" | "channel";
  rawId: string;
  prefix: string;
};

type CasePreservingPeerDescriptor = {
  channel: string;
  peerKinds: ReadonlySet<string>;
  span: "segment" | "tail";
  unscoped: boolean;
};

const CASE_PRESERVING_PEERS: readonly CasePreservingPeerDescriptor[] = [
  { channel: "signal", peerKinds: new Set(["group"]), span: "segment", unscoped: true },
  { channel: "matrix", peerKinds: new Set(["channel", "group"]), span: "tail", unscoped: true },
];

export function isCasePreservingPeer(
  channel: string | undefined | null,
  peerKind: string | undefined | null,
): boolean {
  return findCasePreservingPeerDescriptor(channel, peerKind) !== undefined;
}

function findCasePreservingPeerDescriptor(
  channel: string | undefined | null,
  peerKind: string | undefined | null,
): CasePreservingPeerDescriptor | undefined {
  const c = normalizeLowercaseStringOrEmpty(channel);
  const k = normalizeLowercaseStringOrEmpty(peerKind);
  return CASE_PRESERVING_PEERS.find(
    (descriptor) => descriptor.channel === c && descriptor.peerKinds.has(k),
  );
}

export function requiresFoldedSessionKeyAliasProof(sessionKey: string | undefined | null): boolean {
  const ref = parseRawSessionConversationRef(sessionKey);
  const descriptor = findCasePreservingPeerDescriptor(ref?.channel, ref?.kind);
  return descriptor?.span === "tail";
}

export function normalizeSessionPeerId(params: {
  channel: string | undefined | null;
  peerKind?: string | null;
  peerId?: string | null;
}): string {
  const peerId = (params.peerId ?? "").trim();
  if (!peerId) {
    return "";
  }
  return isCasePreservingPeer(params.channel, params.peerKind)
    ? peerId
    : normalizeLowercaseStringOrEmpty(peerId);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type PreservedSpan = { start: number; end: number; trim: boolean };

function mayContainCasePreservingPeer(raw: string): boolean {
  const folded = raw.toLowerCase();
  return CASE_PRESERVING_PEERS.some((descriptor) => folded.includes(`${descriptor.channel}:`));
}

function collectCasePreservedSpans(raw: string): PreservedSpan[] {
  const spans: PreservedSpan[] = [];
  for (const descriptor of CASE_PRESERVING_PEERS) {
    const channel = escapeRegExp(descriptor.channel);
    for (const peerKind of descriptor.peerKinds) {
      const kind = escapeRegExp(peerKind);
      if (descriptor.span === "segment") {
        const re = new RegExp(`(^|:)${channel}:${kind}:([^:]+)`, "giu");
        for (const match of raw.matchAll(re)) {
          const matched = match[0] ?? "";
          const segment = match[2] ?? "";
          const segStart = (match.index ?? 0) + matched.length - segment.length;
          spans.push({ start: segStart, end: segStart + segment.length, trim: true });
        }
        continue;
      }

      const collectTailSpan = (tailStart: number): void => {
        if (tailStart >= raw.length) {
          return;
        }
        const tail = raw.slice(tailStart);
        const threadMarker = ":thread:";
        const markerIndex = normalizeLowercaseStringOrEmpty(tail).lastIndexOf(threadMarker);
        if (markerIndex === -1) {
          spans.push({ start: tailStart, end: raw.length, trim: false });
          return;
        }
        spans.push({ start: tailStart, end: tailStart + markerIndex, trim: false });
        const threadIdStart = tailStart + markerIndex + threadMarker.length;
        if (threadIdStart < raw.length) {
          spans.push({ start: threadIdStart, end: raw.length, trim: false });
        }
      };

      const scopedRe = new RegExp(`^agent:[^:]+:${channel}:${kind}:`, "iu");
      const scopedMatch = scopedRe.exec(raw);
      if (scopedMatch) {
        collectTailSpan(scopedMatch[0].length);
        continue;
      }
      if (descriptor.unscoped) {
        const unscopedRe = new RegExp(`^${channel}:${kind}:`, "iu");
        const unscopedMatch = unscopedRe.exec(raw);
        if (unscopedMatch) {
          collectTailSpan(unscopedMatch[0].length);
        }
      }
    }
  }
  return spans;
}

export function normalizeSessionKeyPreservingOpaquePeerIds(
  sessionKey: string | undefined | null,
): string {
  const raw = normalizeOptionalString(sessionKey);
  if (!raw) {
    return "";
  }
  if (!mayContainCasePreservingPeer(raw)) {
    return raw.toLowerCase();
  }
  const spans = collectCasePreservedSpans(raw)
    .filter((span) => span.end > span.start)
    .toSorted((a, b) => a.start - b.start);

  let normalized = "";
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) {
      continue;
    }
    normalized += normalizeLowercaseStringOrEmpty(raw.slice(cursor, span.start));
    const preserved = raw.slice(span.start, span.end);
    normalized += span.trim ? preserved.trim() : preserved;
    cursor = span.end;
  }
  normalized += normalizeLowercaseStringOrEmpty(raw.slice(cursor));
  return normalized;
}

/**
 * Parse agent-scoped session keys in a canonical, case-insensitive way.
 * Returned values are canonicalized for stable comparisons/routing while
 * preserving provider-owned opaque peer IDs.
 */
export function parseAgentSessionKey(
  sessionKey: string | undefined | null,
): ParsedAgentSessionKey | null {
  const raw = normalizeSessionKeyPreservingOpaquePeerIds(sessionKey);
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== "agent") {
    return null;
  }
  const agentId = normalizeOptionalString(parts[1]);
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

export function isCronRunSessionKey(sessionKey: string | undefined | null): boolean {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return false;
  }
  return /^cron:[^:]+:run:[^:]+(?::|$)/.test(parsed.rest);
}

export function isCronSessionKey(sessionKey: string | undefined | null): boolean {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return false;
  }
  return normalizeOptionalLowercaseString(parsed.rest)?.startsWith("cron:") === true;
}

export function isSubagentSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = normalizeOptionalString(sessionKey);
  if (!raw) {
    return false;
  }
  if (normalizeOptionalLowercaseString(raw)?.startsWith("subagent:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return normalizeOptionalLowercaseString(parsed?.rest)?.startsWith("subagent:") === true;
}

export function getSubagentDepth(sessionKey: string | undefined | null): number {
  const raw = normalizeOptionalLowercaseString(sessionKey);
  if (!raw) {
    return 0;
  }
  return raw.split(":subagent:").length - 1;
}

export function isAcpSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = normalizeOptionalString(sessionKey);
  if (!raw) {
    return false;
  }
  const normalized = normalizeLowercaseStringOrEmpty(raw);
  if (normalized.startsWith("acp:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return normalizeOptionalLowercaseString(parsed?.rest)?.startsWith("acp:") === true;
}

export function parseThreadSessionSuffix(
  sessionKey: string | undefined | null,
): ParsedThreadSessionSuffix {
  const raw = normalizeOptionalString(sessionKey);
  if (!raw) {
    return { baseSessionKey: undefined, threadId: undefined };
  }

  const lowerRaw = normalizeLowercaseStringOrEmpty(raw);
  const threadMarker = ":thread:";
  const threadIndex = lowerRaw.lastIndexOf(threadMarker);
  const markerIndex = threadIndex;
  const marker = threadMarker;

  const baseSessionKey = markerIndex === -1 ? raw : raw.slice(0, markerIndex);
  const threadIdRaw = markerIndex === -1 ? undefined : raw.slice(markerIndex + marker.length);
  const threadId = normalizeOptionalString(threadIdRaw);

  return { baseSessionKey, threadId };
}

export function parseRawSessionConversationRef(
  sessionKey: string | undefined | null,
): RawSessionConversationRef | null {
  const raw = normalizeOptionalString(sessionKey);
  if (!raw) {
    return null;
  }

  const rawParts = raw.split(":").filter(Boolean);
  const bodyStartIndex =
    rawParts.length >= 3 && normalizeOptionalLowercaseString(rawParts[0]) === "agent" ? 2 : 0;
  const parts = rawParts.slice(bodyStartIndex);
  if (parts.length < 3) {
    return null;
  }

  const channel = normalizeOptionalLowercaseString(parts[0]);
  const kind = normalizeOptionalLowercaseString(parts[1]);
  if (!channel || (kind !== "group" && kind !== "channel")) {
    return null;
  }

  const rawId = normalizeOptionalString(parts.slice(2).join(":"));
  const prefix = normalizeOptionalString(rawParts.slice(0, bodyStartIndex + 2).join(":"));
  if (!rawId || !prefix) {
    return null;
  }

  return { channel, kind, rawId, prefix };
}

export function resolveThreadParentSessionKey(
  sessionKey: string | undefined | null,
): string | null {
  const { baseSessionKey, threadId } = parseThreadSessionSuffix(sessionKey);
  if (!threadId) {
    return null;
  }
  const parent = normalizeOptionalString(baseSessionKey);
  if (!parent) {
    return null;
  }
  return parent;
}
