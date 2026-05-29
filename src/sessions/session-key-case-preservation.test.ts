import { describe, expect, it } from "vitest";
import { resolveSessionStoreEntry } from "../config/sessions/store-entry.js";
import type { SessionEntry } from "../config/sessions/types.js";
import { buildAgentPeerSessionKey, buildGroupHistoryKey } from "../routing/session-key.js";
import {
  isCasePreservingPeer,
  normalizeSessionKeyPreservingOpaquePeerIds,
  normalizeSessionPeerId,
  requiresFoldedSessionKeyAliasProof,
} from "./session-key-utils.js";

const ROOM_MIXED_KEY = "agent:main:matrix:channel:!MixedRoomAbCdEf:example.org";
const ROOM_LOWER_KEY = "agent:main:matrix:channel:!mixedroomabcdef:example.org";
const ROOM_A = "!MixedRoomAbCdEf:example.org";
const ROOM_B = "!OtherRoomGhIjKl:matrix.example.org";
const EVENT = "$EvMixedCaseAbCdEfGhIjKlMnOpQrStUvWxYz0";

const entry = (to: string, updatedAt: number): SessionEntry =>
  ({ sessionId: "s", updatedAt, deliveryContext: { channel: "matrix", to } }) as SessionEntry;

describe("session key case preservation", () => {
  it("enrolls only opaque Matrix rooms and Signal groups", () => {
    expect(isCasePreservingPeer("matrix", "channel")).toBe(true);
    expect(isCasePreservingPeer("matrix", "group")).toBe(true);
    expect(isCasePreservingPeer("matrix", "direct")).toBe(false);
    expect(isCasePreservingPeer("signal", "group")).toBe(true);
    expect(isCasePreservingPeer("telegram", "group")).toBe(false);
  });

  it("preserves Matrix and Signal peer ids while lowercasing normal peers", () => {
    expect(normalizeSessionPeerId({ channel: "matrix", peerKind: "channel", peerId: ROOM_A })).toBe(
      ROOM_A,
    );
    expect(
      normalizeSessionPeerId({ channel: "signal", peerKind: "group", peerId: "AbC123=" }),
    ).toBe("AbC123=");
    expect(
      normalizeSessionPeerId({ channel: "telegram", peerKind: "group", peerId: "Mixed" }),
    ).toBe("mixed");
  });

  it("preserves Matrix room and thread event ids inside full session keys", () => {
    const key = `Agent:Main:Matrix:Channel:${ROOM_A}:Thread:${EVENT}`;
    expect(normalizeSessionKeyPreservingOpaquePeerIds(key)).toBe(
      `agent:main:matrix:channel:${ROOM_A}:thread:${EVENT}`,
    );
  });

  it("marks Matrix folded aliases as requiring delivery proof", () => {
    expect(requiresFoldedSessionKeyAliasProof(`agent:main:matrix:channel:${ROOM_A}`)).toBe(true);
    expect(requiresFoldedSessionKeyAliasProof("agent:ops:signal:group:AbC123=")).toBe(false);
  });

  it("builds agent and history keys without lowercasing Matrix room ids", () => {
    expect(
      buildAgentPeerSessionKey({
        agentId: "main",
        channel: "matrix",
        peerKind: "channel",
        peerId: ROOM_B,
      }),
    ).toBe(`agent:main:matrix:channel:${ROOM_B}`);
    expect(buildGroupHistoryKey({ channel: "matrix", peerKind: "channel", peerId: ROOM_B })).toBe(
      `matrix:default:channel:${ROOM_B}`,
    );
  });

  it("does not collapse a genuinely case-distinct Matrix room", () => {
    const store: Record<string, SessionEntry> = {
      [ROOM_MIXED_KEY]: entry("room:!MixedRoomAbCdEf:example.org", 100),
      [ROOM_LOWER_KEY]: entry("room:!mixedroomabcdef:example.org", 999),
    };
    const result = resolveSessionStoreEntry({ store, sessionKey: ROOM_MIXED_KEY });
    expect(result.normalizedKey).toBe(ROOM_MIXED_KEY);
    expect(result.legacyKeys).toEqual([]);
    expect(result.existing?.deliveryContext?.to).toBe("room:!MixedRoomAbCdEf:example.org");
  });

  it("collapses a lowercased legacy artifact only when delivery proof matches", () => {
    const store: Record<string, SessionEntry> = {
      [ROOM_LOWER_KEY]: entry("room:!MixedRoomAbCdEf:example.org", 50),
    };
    const result = resolveSessionStoreEntry({ store, sessionKey: ROOM_MIXED_KEY });
    expect(result.normalizedKey).toBe(ROOM_MIXED_KEY);
    expect(result.legacyKeys).toContain(ROOM_LOWER_KEY);
    expect(result.existing).toBe(store[ROOM_LOWER_KEY]);
  });
});
