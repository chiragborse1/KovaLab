import { describe, expect, it } from "vitest";
import { isKovaManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects Kova-managed device names", () => {
    expect(isKovaManagedMatrixDevice("Kova Gateway")).toBe(true);
    expect(isKovaManagedMatrixDevice("Kova Debug")).toBe(true);
    expect(isKovaManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isKovaManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale Kova-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "Kova Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "Kova Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "Kova Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary.currentDeviceId).toBe("du314Zpw3A");
    expect(summary.currentKovaDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleKovaDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
