import type { Page } from "playwright-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SsrFBlockedError } from "../infra/net/ssrf.js";
import {
  assertBrowserNavigationRedirectChainAllowed,
  assertBrowserNavigationResultAllowed,
} from "./navigation-guard.js";
import { assertPageNavigationCompletedSafely } from "./pw-session.js";

vi.mock("./navigation-guard.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    assertBrowserNavigationRedirectChainAllowed: vi.fn(async () => {}),
    assertBrowserNavigationResultAllowed: vi.fn(async () => {}),
  };
});

const mockedRedirectChain = vi.mocked(assertBrowserNavigationRedirectChainAllowed);
const mockedResultAllowed = vi.mocked(assertBrowserNavigationResultAllowed);

afterEach(() => {
  mockedRedirectChain.mockReset();
  mockedRedirectChain.mockImplementation(async () => {});
  mockedResultAllowed.mockReset();
  mockedResultAllowed.mockImplementation(async () => {});
});

function fakePage(url = "https://blocked.example/admin"): {
  page: Page;
  close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn(async () => {});
  const page = {
    url: vi.fn(() => url),
    close,
  } as unknown as Page;
  return { page, close };
}

describe("assertPageNavigationCompletedSafely", () => {
  it("does not close the tab when a read-only caller hits an SSRF-blocked URL", async () => {
    mockedResultAllowed.mockRejectedValueOnce(new SsrFBlockedError("blocked by policy"));
    const { page, close } = fakePage();

    await expect(
      assertPageNavigationCompletedSafely({
        cdpUrl: "http://127.0.0.1:18792",
        page,
        response: null,
        ssrfPolicy: { allowPrivateNetwork: false },
        targetId: "tab-1",
      }),
    ).rejects.toBeInstanceOf(SsrFBlockedError);

    expect(close).not.toHaveBeenCalled();
  });

  it("does not close the tab when a navigate helper hits an SSRF-blocked URL", async () => {
    mockedResultAllowed.mockRejectedValueOnce(new SsrFBlockedError("blocked by policy"));
    const { page, close } = fakePage();
    const response = { request: () => undefined } as unknown as Parameters<
      typeof assertPageNavigationCompletedSafely
    >[0]["response"];

    await expect(
      assertPageNavigationCompletedSafely({
        cdpUrl: "http://127.0.0.1:18792",
        page,
        response,
        ssrfPolicy: { allowPrivateNetwork: false },
        targetId: "tab-1",
      }),
    ).rejects.toBeInstanceOf(SsrFBlockedError);

    expect(close).not.toHaveBeenCalled();
  });

  it("rethrows non-policy errors without touching the tab", async () => {
    const boom = new Error("transient playwright error");
    mockedResultAllowed.mockRejectedValueOnce(boom);
    const { page, close } = fakePage();

    await expect(
      assertPageNavigationCompletedSafely({
        cdpUrl: "http://127.0.0.1:18792",
        page,
        response: null,
        ssrfPolicy: { allowPrivateNetwork: false },
        targetId: "tab-1",
      }),
    ).rejects.toBe(boom);

    expect(close).not.toHaveBeenCalled();
  });

  it("returns silently when both guards pass", async () => {
    const { page, close } = fakePage("https://allowed.example/");

    await expect(
      assertPageNavigationCompletedSafely({
        cdpUrl: "http://127.0.0.1:18792",
        page,
        response: null,
        ssrfPolicy: { allowPrivateNetwork: false },
        targetId: "tab-1",
      }),
    ).resolves.toBeUndefined();

    expect(close).not.toHaveBeenCalled();
    expect(mockedResultAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://allowed.example/" }),
    );
  });
});
