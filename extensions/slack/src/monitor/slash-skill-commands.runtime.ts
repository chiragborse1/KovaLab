import { listSkillCommandsForAgents as listSkillCommandsForAgentsImpl } from "getkova/plugin-sdk/command-auth";

type ListSkillCommandsForAgents =
  typeof import("getkova/plugin-sdk/command-auth").listSkillCommandsForAgents;

export function listSkillCommandsForAgents(
  ...args: Parameters<ListSkillCommandsForAgents>
): ReturnType<ListSkillCommandsForAgents> {
  return listSkillCommandsForAgentsImpl(...args);
}
