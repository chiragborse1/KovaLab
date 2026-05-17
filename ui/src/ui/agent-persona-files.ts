export const PERSONA_WORKSPACE_FILE_NAMES = ["IDENTITY.md", "SOUL.md", "USER.md"] as const;

export type PersonaWorkspaceFileName = (typeof PERSONA_WORKSPACE_FILE_NAMES)[number];

const PERSONA_WORKSPACE_FILE_NAME_SET = new Set<string>(PERSONA_WORKSPACE_FILE_NAMES);

export function isPersonaWorkspaceFileName(name: string): name is PersonaWorkspaceFileName {
  return PERSONA_WORKSPACE_FILE_NAME_SET.has(name);
}
