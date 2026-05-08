import { describe, expect, it, vi } from "vitest";
import {
  beginTelegramInboundTurnDeliveryCorrelation,
  notifyTelegramInboundTurnOutboundSuccess,
} from "./inbound-turn-delivery.js";

describe("telegram inbound turn delivery correlation", () => {
  it("marks the active inbound turn delivered when a matching message action succeeds", () => {
    const markInboundTurnDelivered = vi.fn();
    const end = beginTelegramInboundTurnDeliveryCorrelation("session-1", {
      outboundTo: "123",
      outboundAccountId: "default",
      markInboundTurnDelivered,
    });

    notifyTelegramInboundTurnOutboundSuccess({
      sessionKey: "session-1",
      to: "123",
      accountId: "default",
    });

    expect(markInboundTurnDelivered).toHaveBeenCalledTimes(1);
    end();
  });

  it("ignores mismatched sessions, targets, and accounts", () => {
    const markInboundTurnDelivered = vi.fn();
    const end = beginTelegramInboundTurnDeliveryCorrelation("session-1", {
      outboundTo: "123",
      outboundAccountId: "default",
      markInboundTurnDelivered,
    });

    notifyTelegramInboundTurnOutboundSuccess({
      sessionKey: "session-2",
      to: "123",
      accountId: "default",
    });
    notifyTelegramInboundTurnOutboundSuccess({
      sessionKey: "session-1",
      to: "456",
      accountId: "default",
    });
    notifyTelegramInboundTurnOutboundSuccess({
      sessionKey: "session-1",
      to: "123",
      accountId: "other",
    });

    expect(markInboundTurnDelivered).not.toHaveBeenCalled();
    end();
  });

  it("stops correlating after the inbound turn ends", () => {
    const markInboundTurnDelivered = vi.fn();
    const end = beginTelegramInboundTurnDeliveryCorrelation("session-1", {
      outboundTo: "123",
      markInboundTurnDelivered,
    });
    end();

    notifyTelegramInboundTurnOutboundSuccess({
      sessionKey: "session-1",
      to: "123",
    });

    expect(markInboundTurnDelivered).not.toHaveBeenCalled();
  });
});
