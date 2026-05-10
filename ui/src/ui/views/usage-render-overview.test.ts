/* @vitest-environment jsdom */

import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderUsageInsights } from "./usage-render-overview.ts";
import type { UsageAggregates, UsageTotals } from "./usageTypes.ts";

const totals: UsageTotals = {
  input: 100,
  output: 40,
  cacheRead: 300,
  cacheWrite: 600,
  totalTokens: 1040,
  totalCost: 0,
  inputCost: 0,
  outputCost: 0,
  cacheReadCost: 0,
  cacheWriteCost: 0,
  missingCostEntries: 0,
};

const aggregates = {
  messages: {
    total: 4,
    user: 2,
    assistant: 2,
    toolCalls: 0,
    toolResults: 0,
    errors: 0,
  },
  tools: {
    totalCalls: 0,
    uniqueTools: 0,
    tools: [],
  },
  byModel: [],
  byProvider: [],
  byAgent: [],
  byChannel: [],
  daily: [
    { date: "2026-05-08", tokens: 120, cost: 0.01, messages: 2, toolCalls: 0, errors: 0 },
    { date: "2026-05-09", tokens: 320, cost: 0.03, messages: 4, toolCalls: 1, errors: 0 },
    { date: "2026-05-10", tokens: 180, cost: 0.02, messages: 3, toolCalls: 0, errors: 0 },
  ],
} as unknown as UsageAggregates;

describe("renderUsageInsights", () => {
  it("includes cache writes in cache-hit-rate denominator", () => {
    const container = document.createElement("div");

    render(
      renderUsageInsights(
        totals,
        aggregates,
        {
          durationSumMs: 0,
          durationCount: 0,
          avgDurationMs: 0,
          errorRate: 0,
        },
        false,
        [],
        1,
        1,
      ),
      container,
    );

    expect(container.textContent).toContain("30.0%");
    expect(container.textContent).toContain("300 cached");
    expect(container.textContent).toContain("1.0K prompt");
    expect(container.querySelector(".usage-wave-card")).not.toBeNull();
    expect(container.querySelector(".usage-wave-line")).not.toBeNull();
  });
});
