import { describe, expect, it } from "vitest";
import type { KovaConfig } from "../../config/types.kova.js";
import { loadProviderIndexCatalogRowsForList } from "./list.provider-index-catalog.js";

const baseConfig = {} satisfies KovaConfig;

describe("loadProviderIndexCatalogRowsForList", () => {
  it("returns provider-index preview rows when the provider plugin is enabled", () => {
    expect(
      loadProviderIndexCatalogRowsForList({
        cfg: baseConfig,
        providerFilter: "moonshot",
      }).map((row) => row.ref),
    ).toContain("moonshot/kimi-k2.6");
  });

  it("suppresses provider-index preview rows when the provider plugin is disabled", () => {
    expect(
      loadProviderIndexCatalogRowsForList({
        cfg: {
          plugins: {
            entries: {
              moonshot: { enabled: false },
            },
          },
        },
        providerFilter: "moonshot",
      }),
    ).toEqual([]);
  });
});
