import { describe, expect, it, vi } from "vitest";
import {
  installSkill,
  loadKovaHubDetail,
  saveSkillApiKey,
  searchKovaHub,
  setKovaHubSearchQuery,
  updateSkillEnabled,
  type SkillsState,
} from "./skills.ts";

function createState(): { state: SkillsState; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn();
  const state: SkillsState = {
    client: {
      request,
    } as unknown as SkillsState["client"],
    connected: true,
    skillsLoading: false,
    skillsReport: null,
    skillsError: null,
    skillsBusyKey: null,
    skillEdits: {},
    skillMessages: {},
    kovahubSearchQuery: "github",
    kovahubSearchResults: [
      {
        score: 0.9,
        slug: "github",
        displayName: "GitHub",
        summary: "Previous result",
        version: "1.0.0",
      },
    ],
    kovahubSearchLoading: false,
    kovahubSearchError: "old error",
    kovahubDetail: null,
    kovahubDetailSlug: null,
    kovahubDetailLoading: false,
    kovahubDetailError: null,
    kovahubInstallSlug: null,
    kovahubInstallMessage: null,
  };
  return { state, request };
}

function createDeferredRequestQueue(request: ReturnType<typeof vi.fn>) {
  const resolvers: Array<(value: unknown) => void> = [];
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      }),
  );
  return {
    resolveNext(value: unknown) {
      resolvers.shift()?.(value);
    },
  };
}

function mockSkillMutationRequests(request: ReturnType<typeof vi.fn>, installMessage?: string) {
  request.mockImplementation(async (method: string) => {
    if (method === "skills.install" && installMessage) {
      return { message: installMessage };
    }
    return {};
  });
}

describe("searchKovaHub", () => {
  it("clears stale query state immediately when the input changes", () => {
    const { state } = createState();

    state.kovahubSearchLoading = true;
    state.kovahubInstallMessage = { kind: "success", text: "Installed github" };

    setKovaHubSearchQuery(state, "github app");

    expect(state.kovahubSearchQuery).toBe("github app");
    expect(state.kovahubSearchResults).toBeNull();
    expect(state.kovahubSearchError).toBeNull();
    expect(state.kovahubSearchLoading).toBe(false);
    expect(state.kovahubInstallMessage).toBeNull();
  });

  it("clears stale results as soon as a new search starts", async () => {
    const { state, request } = createState();
    type SearchResponse = { results: SkillsState["kovahubSearchResults"] };
    let resolveRequest: (value: SearchResponse) => void = () => {
      throw new Error("expected search request promise to be pending");
    };
    request.mockImplementation(
      () =>
        new Promise<SearchResponse>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const pending = searchKovaHub(state, "github");

    expect(state.kovahubSearchResults).toBeNull();
    expect(state.kovahubSearchLoading).toBe(true);
    expect(state.kovahubSearchError).toBeNull();

    resolveRequest({
      results: [
        {
          score: 0.95,
          slug: "github-new",
          displayName: "GitHub New",
          summary: "Fresh result",
          version: "2.0.0",
        },
      ],
    });
    await pending;

    expect(state.kovahubSearchResults).toEqual([
      {
        score: 0.95,
        slug: "github-new",
        displayName: "GitHub New",
        summary: "Fresh result",
        version: "2.0.0",
      },
    ]);
    expect(state.kovahubSearchLoading).toBe(false);
  });

  it("clears stale results when the query is emptied", async () => {
    const { state, request } = createState();

    await searchKovaHub(state, "   ");

    expect(request).not.toHaveBeenCalled();
    expect(state.kovahubSearchResults).toBeNull();
    expect(state.kovahubSearchError).toBeNull();
    expect(state.kovahubSearchLoading).toBe(false);
  });

  it("ignores stale search responses after query changes", async () => {
    const { state, request } = createState();
    const queue = createDeferredRequestQueue(request);

    const pending = searchKovaHub(state, "github");
    setKovaHubSearchQuery(state, "gitlab");
    queue.resolveNext({
      results: [{ score: 1, slug: "github", displayName: "GitHub" }],
    });
    await pending;

    expect(state.kovahubSearchQuery).toBe("gitlab");
    expect(state.kovahubSearchResults).toBeNull();
    expect(state.kovahubSearchError).toBeNull();
    expect(state.kovahubSearchLoading).toBe(false);
  });
});

describe("loadKovaHubDetail", () => {
  it("ignores stale detail responses after slug changes", async () => {
    const { state, request } = createState();
    const queue = createDeferredRequestQueue(request);

    const firstPending = loadKovaHubDetail(state, "github");
    const secondPending = loadKovaHubDetail(state, "gitlab");

    queue.resolveNext({
      skill: { slug: "github", displayName: "GitHub", createdAt: 1, updatedAt: 2 },
    });
    await firstPending;

    queue.resolveNext({
      skill: { slug: "gitlab", displayName: "GitLab", createdAt: 3, updatedAt: 4 },
    });
    await secondPending;

    expect(state.kovahubDetailLoading).toBe(false);
    expect(state.kovahubDetail?.skill?.slug).toBe("gitlab");
  });
});

describe("skill mutations", () => {
  it.each([
    {
      name: "updates skill enablement and records a success message",
      run: (state: SkillsState) => updateSkillEnabled(state, "github", true),
      expectedRequest: ["skills.update", { skillKey: "github", enabled: true }],
      expectedMessage: "Skill enabled",
    },
    {
      name: "saves API keys and reports success",
      run: async (state: SkillsState) => {
        state.skillEdits.github = "sk-test";
        await saveSkillApiKey(state, "github");
      },
      expectedRequest: ["skills.update", { skillKey: "github", apiKey: "sk-test" }],
      expectedMessage:
        "API key saved — stored in the Kova config file (kova.json -> skills.entries.github)",
    },
    {
      name: "installs skills and uses server success messages",
      run: (state: SkillsState) => installSkill(state, "github", "GitHub", "install-123", true),
      expectedRequest: [
        "skills.install",
        {
          name: "GitHub",
          installId: "install-123",
          dangerouslyForceUnsafeInstall: true,
          timeoutMs: 120000,
        },
      ],
      expectedMessage: "Installed from registry",
      installMessage: "Installed from registry",
    },
  ])("$name", async ({ run, expectedRequest, expectedMessage, installMessage }) => {
    const { state, request } = createState();
    mockSkillMutationRequests(request, installMessage);

    await run(state);

    const [method, params] = expectedRequest;
    expect(request).toHaveBeenCalledWith(method, params);
    expect(state.skillMessages.github).toEqual({ kind: "success", message: expectedMessage });
    expect(state.skillsBusyKey).toBeNull();
    expect(state.skillsError).toBeNull();
  });

  it("records errors from failed mutations", async () => {
    const { state, request } = createState();
    request.mockRejectedValue(new Error("skills update failed"));

    await updateSkillEnabled(state, "github", false);

    expect(state.skillsError).toBe("skills update failed");
    expect(state.skillMessages.github).toEqual({
      kind: "error",
      message: "skills update failed",
    });
    expect(state.skillsBusyKey).toBeNull();
  });
});
