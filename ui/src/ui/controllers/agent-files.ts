import { PERSONA_WORKSPACE_FILE_NAMES } from "../agent-persona-files.ts";
import type { GatewayBrowserClient } from "../gateway.ts";
import type {
  AgentFileEntry,
  AgentsFilesGetResult,
  AgentsFilesListResult,
  AgentsFilesSetResult,
} from "../types.ts";

export type AgentFilesState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentFilesLoading: boolean;
  agentFilesError: string | null;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesRequestVersion: number;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileActive: string | null;
  agentFileSaving: boolean;
};

function mergeFileEntry(
  list: AgentsFilesListResult | null,
  entry: AgentFileEntry,
): AgentsFilesListResult | null {
  if (!list) {
    return list;
  }
  const hasEntry = list.files.some((file) => file.name === entry.name);
  const nextFiles = hasEntry
    ? list.files.map((file) => (file.name === entry.name ? entry : file))
    : [...list.files, entry];
  return { ...list, files: nextFiles };
}

function applyLoadedFileContent(
  state: AgentFilesState,
  entry: AgentFileEntry,
  content: string,
  opts?: { preserveDraft?: boolean },
) {
  const name = entry.name;
  const previousBase = state.agentFileContents[name] ?? "";
  const currentDraft = state.agentFileDrafts[name];
  const preserveDraft = opts?.preserveDraft ?? true;
  state.agentFilesList = mergeFileEntry(state.agentFilesList, entry);
  state.agentFileContents = { ...state.agentFileContents, [name]: content };
  if (
    !preserveDraft ||
    !Object.hasOwn(state.agentFileDrafts, name) ||
    currentDraft === previousBase
  ) {
    state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
  }
}

export function cancelAgentFilesRequests(state: AgentFilesState) {
  state.agentFilesRequestVersion += 1;
  state.agentFilesLoading = false;
}

export async function loadAgentFiles(state: AgentFilesState, agentId: string) {
  if (!state.client || !state.connected || state.agentFilesLoading) {
    return;
  }
  state.agentFilesRequestVersion += 1;
  const requestVersion = state.agentFilesRequestVersion;
  state.agentFilesLoading = true;
  state.agentFilesError = null;
  try {
    const res = await state.client.request<AgentsFilesListResult | null>("agents.files.list", {
      agentId,
    });
    if (state.agentFilesRequestVersion !== requestVersion || res?.agentId !== agentId) {
      return;
    }
    if (res) {
      state.agentFilesList = res;
      if (state.agentFileActive && !res.files.some((file) => file.name === state.agentFileActive)) {
        state.agentFileActive = null;
      }
    }
  } catch (err) {
    if (state.agentFilesRequestVersion === requestVersion) {
      state.agentFilesError = String(err);
    }
  } finally {
    if (state.agentFilesRequestVersion === requestVersion) {
      state.agentFilesLoading = false;
    }
  }
}

export async function loadAgentFileContent(
  state: AgentFilesState,
  agentId: string,
  name: string,
  opts?: { force?: boolean; preserveDraft?: boolean },
) {
  if (!state.client || !state.connected || state.agentFilesLoading) {
    return;
  }
  if (!opts?.force && Object.hasOwn(state.agentFileContents, name)) {
    return;
  }
  state.agentFilesRequestVersion += 1;
  const requestVersion = state.agentFilesRequestVersion;
  state.agentFilesLoading = true;
  state.agentFilesError = null;
  try {
    const res = await state.client.request<AgentsFilesGetResult | null>("agents.files.get", {
      agentId,
      name,
    });
    if (
      state.agentFilesRequestVersion !== requestVersion ||
      res?.agentId !== agentId ||
      res.file.name !== name ||
      state.agentFileActive !== name
    ) {
      return;
    }
    if (res?.file) {
      const content = res.file.content ?? "";
      applyLoadedFileContent(state, res.file, content, {
        preserveDraft: opts?.preserveDraft ?? true,
      });
    }
  } catch (err) {
    if (state.agentFilesRequestVersion === requestVersion) {
      state.agentFilesError = String(err);
    }
  } finally {
    if (state.agentFilesRequestVersion === requestVersion) {
      state.agentFilesLoading = false;
    }
  }
}

export async function loadAgentPersonaFiles(state: AgentFilesState, agentId: string) {
  if (!state.client || !state.connected || state.agentFilesLoading) {
    return;
  }
  state.agentFilesRequestVersion += 1;
  const requestVersion = state.agentFilesRequestVersion;
  state.agentFilesLoading = true;
  state.agentFilesError = null;
  try {
    const list = await state.client.request<AgentsFilesListResult | null>("agents.files.list", {
      agentId,
    });
    if (state.agentFilesRequestVersion !== requestVersion || list?.agentId !== agentId) {
      return;
    }
    if (list) {
      state.agentFilesList = list;
      if (
        state.agentFileActive &&
        !list.files.some((file) => file.name === state.agentFileActive)
      ) {
        state.agentFileActive = null;
      }
    }
    for (const name of PERSONA_WORKSPACE_FILE_NAMES) {
      if (state.agentFilesRequestVersion !== requestVersion) {
        return;
      }
      const res = await state.client.request<AgentsFilesGetResult | null>("agents.files.get", {
        agentId,
        name,
      });
      if (
        state.agentFilesRequestVersion !== requestVersion ||
        res?.agentId !== agentId ||
        res.file.name !== name
      ) {
        return;
      }
      applyLoadedFileContent(state, res.file, res.file.content ?? "");
    }
  } catch (err) {
    if (state.agentFilesRequestVersion === requestVersion) {
      state.agentFilesError = String(err);
    }
  } finally {
    if (state.agentFilesRequestVersion === requestVersion) {
      state.agentFilesLoading = false;
    }
  }
}

export async function saveAgentFile(
  state: AgentFilesState,
  agentId: string,
  name: string,
  content: string,
) {
  if (!state.client || !state.connected || state.agentFileSaving) {
    return;
  }
  state.agentFileSaving = true;
  state.agentFilesError = null;
  try {
    const res = await state.client.request<AgentsFilesSetResult | null>("agents.files.set", {
      agentId,
      name,
      content,
    });
    if (res?.agentId !== agentId || res.file.name !== name) {
      return;
    }
    if (res?.file) {
      const activeListAgent = state.agentFilesList?.agentId ?? null;
      if (activeListAgent === agentId) {
        state.agentFilesList = mergeFileEntry(state.agentFilesList, res.file);
        state.agentFileContents = { ...state.agentFileContents, [name]: content };
        state.agentFileDrafts = { ...state.agentFileDrafts, [name]: content };
      }
    }
  } catch (err) {
    state.agentFilesError = String(err);
  } finally {
    state.agentFileSaving = false;
  }
}
