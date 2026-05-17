import { describe, expect, it } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  AgentsFilesGetResult,
  AgentsFilesListResult,
  AgentsFilesSetResult,
} from "../types.ts";
import {
  cancelAgentFilesRequests,
  loadAgentFiles,
  loadAgentFileContent,
  loadAgentPersonaFiles,
  saveAgentFile,
  type AgentFilesState,
} from "./agent-files.ts";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function createState(request: GatewayBrowserClient["request"]): AgentFilesState {
  return {
    client: { request } as unknown as GatewayBrowserClient,
    connected: true,
    agentFilesLoading: false,
    agentFilesError: null,
    agentFilesList: null,
    agentFilesRequestVersion: 0,
    agentFileContents: {},
    agentFileDrafts: {},
    agentFileActive: "AGENTS.md",
    agentFileSaving: false,
  };
}

function fileResult(agentId: string, content: string, name = "AGENTS.md"): AgentsFilesGetResult {
  return {
    agentId,
    workspace: `/workspace/${agentId}`,
    file: {
      name,
      path: `/workspace/${agentId}/${name}`,
      missing: false,
      content,
    },
  };
}

function listResult(agentId: string, names = ["AGENTS.md"]): AgentsFilesListResult {
  return {
    agentId,
    workspace: `/workspace/${agentId}`,
    files: names.map((name) => ({
      name,
      path: `/workspace/${agentId}/${name}`,
      missing: false,
    })),
  };
}

function saveResult(agentId: string, content: string): AgentsFilesSetResult {
  return {
    ok: true,
    agentId,
    workspace: `/workspace/${agentId}`,
    file: {
      name: "AGENTS.md",
      path: `/workspace/${agentId}/AGENTS.md`,
      missing: false,
      content,
    },
  };
}

describe("agent file controller", () => {
  it("clears loading on cancellation so the next file list can load", async () => {
    const agentA = deferred<AgentsFilesListResult | null>();
    const agentB = deferred<AgentsFilesListResult | null>();
    const request: GatewayBrowserClient["request"] = async <T = unknown>(
      _method: string,
      params?: unknown,
    ): Promise<T> => {
      const agentId = (params as { agentId?: string }).agentId;
      const result = await (agentId === "agent-a" ? agentA.promise : agentB.promise);
      return result as T;
    };
    const state = createState(request);

    const loadA = loadAgentFiles(state, "agent-a");
    expect(state.agentFilesLoading).toBe(true);
    cancelAgentFilesRequests(state);
    expect(state.agentFilesLoading).toBe(false);
    const loadB = loadAgentFiles(state, "agent-b");

    agentA.resolve(listResult("agent-a"));
    await loadA;
    expect(state.agentFilesList).toBeNull();
    expect(state.agentFilesLoading).toBe(true);

    agentB.resolve(listResult("agent-b"));
    await loadB;
    expect(state.agentFilesList?.agentId).toBe("agent-b");
    expect(state.agentFilesLoading).toBe(false);
  });

  it("ignores stale load errors and cleanup while a newer load is running", async () => {
    const agentA = deferred<AgentsFilesGetResult | null>();
    const agentB = deferred<AgentsFilesGetResult | null>();
    const request: GatewayBrowserClient["request"] = async <T = unknown>(
      _method: string,
      params?: unknown,
    ): Promise<T> => {
      const agentId = (params as { agentId?: string }).agentId;
      const result = await (agentId === "agent-a" ? agentA.promise : agentB.promise);
      return result as T;
    };
    const state = createState(request);

    const loadA = loadAgentFileContent(state, "agent-a", "AGENTS.md", { force: true });
    cancelAgentFilesRequests(state);
    const loadB = loadAgentFileContent(state, "agent-b", "AGENTS.md", { force: true });

    agentA.reject(new Error("old agent failed"));
    await loadA;
    expect(state.agentFilesError).toBeNull();
    expect(state.agentFilesLoading).toBe(true);

    agentB.resolve(fileResult("agent-b", "current workspace content"));
    await loadB;
    expect(state.agentFilesLoading).toBe(false);
    expect(state.agentFileContents).toEqual({ "AGENTS.md": "current workspace content" });
  });

  it("ignores stale file responses after the active agent changes", async () => {
    const agentA = deferred<AgentsFilesGetResult | null>();
    const agentB = deferred<AgentsFilesGetResult | null>();
    const request: GatewayBrowserClient["request"] = async <T = unknown>(
      _method: string,
      params?: unknown,
    ): Promise<T> => {
      const agentId = (params as { agentId?: string }).agentId;
      const result = await (agentId === "agent-a" ? agentA.promise : agentB.promise);
      return result as T;
    };
    const state = createState(request);

    const loadA = loadAgentFileContent(state, "agent-a", "AGENTS.md", { force: true });
    cancelAgentFilesRequests(state);
    state.agentFileActive = "AGENTS.md";
    const loadB = loadAgentFileContent(state, "agent-b", "AGENTS.md", { force: true });

    agentA.resolve(fileResult("agent-a", "old workspace content"));
    await loadA;
    expect(state.agentFileContents).toEqual({});
    expect(state.agentFileDrafts).toEqual({});

    agentB.resolve(fileResult("agent-b", "current workspace content"));
    await loadB;
    expect(state.agentFileContents).toEqual({ "AGENTS.md": "current workspace content" });
    expect(state.agentFileDrafts).toEqual({ "AGENTS.md": "current workspace content" });
  });

  it("ignores file responses for a file that is no longer active", async () => {
    const pending = deferred<AgentsFilesGetResult | null>();
    const request: GatewayBrowserClient["request"] = async <T = unknown>(): Promise<T> => {
      const result = await pending.promise;
      return result as T;
    };
    const state = createState(request);

    const load = loadAgentFileContent(state, "main", "AGENTS.md", { force: true });
    state.agentFileActive = "USER.md";
    pending.resolve(fileResult("main", "stale file content"));
    await load;

    expect(state.agentFileContents).toEqual({});
    expect(state.agentFileDrafts).toEqual({});
  });

  it("accepts successful saves after the user switches to another file", async () => {
    const pending = deferred<AgentsFilesSetResult | null>();
    const request: GatewayBrowserClient["request"] = async <T = unknown>(): Promise<T> => {
      const result = await pending.promise;
      return result as T;
    };
    const state = createState(request);
    state.agentFilesList = listResult("main");
    state.agentFileContents = { "AGENTS.md": "old content" };
    state.agentFileDrafts = { "AGENTS.md": "edited content" };

    const save = saveAgentFile(state, "main", "AGENTS.md", "edited content");
    state.agentFileActive = "USER.md";
    pending.resolve(saveResult("main", "edited content"));
    await save;

    expect(state.agentFileContents["AGENTS.md"]).toBe("edited content");
    expect(state.agentFileDrafts["AGENTS.md"]).toBe("edited content");
    expect(state.agentFileSaving).toBe(false);
  });

  it("loads persona workspace files without changing the active file", async () => {
    const calls: Array<{ method: string; agentId?: string; name?: string }> = [];
    const request: GatewayBrowserClient["request"] = async <T = unknown>(
      method: string,
      params?: unknown,
    ): Promise<T> => {
      const requestParams = params as { agentId?: string; name?: string };
      calls.push({ method, agentId: requestParams.agentId, name: requestParams.name });
      if (method === "agents.files.list") {
        return listResult("main", ["AGENTS.md", "IDENTITY.md", "SOUL.md", "USER.md"]) as T;
      }
      return fileResult("main", `${requestParams.name} content`, requestParams.name) as T;
    };
    const state = createState(request);
    state.agentFileActive = "AGENTS.md";

    await loadAgentPersonaFiles(state, "main");

    expect(calls).toEqual([
      { method: "agents.files.list", agentId: "main", name: undefined },
      { method: "agents.files.get", agentId: "main", name: "IDENTITY.md" },
      { method: "agents.files.get", agentId: "main", name: "SOUL.md" },
      { method: "agents.files.get", agentId: "main", name: "USER.md" },
    ]);
    expect(state.agentFileActive).toBe("AGENTS.md");
    expect(state.agentFileContents).toMatchObject({
      "IDENTITY.md": "IDENTITY.md content",
      "SOUL.md": "SOUL.md content",
      "USER.md": "USER.md content",
    });
    expect(state.agentFileDrafts).toMatchObject(state.agentFileContents);
    expect(state.agentFilesLoading).toBe(false);
  });
});
