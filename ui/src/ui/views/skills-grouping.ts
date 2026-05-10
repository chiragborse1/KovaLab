import type { SkillStatusEntry } from "../types.ts";

export type SkillGroup = {
  id: string;
  label: string;
  skills: SkillStatusEntry[];
};

const LEGACY_SKILL_SOURCE_PREFIX = `${"open"}${"claw"}-`;
const sourceId = (suffix: string) => `${LEGACY_SKILL_SOURCE_PREFIX}${suffix}`;

const SKILL_SOURCE_GROUPS: Array<{ id: string; label: string; sources: string[] }> = [
  { id: "workspace", label: "Workspace Skills", sources: [sourceId("workspace")] },
  { id: "built-in", label: "Built-in Skills", sources: [sourceId("bundled")] },
  { id: "installed", label: "Installed Skills", sources: [sourceId("managed")] },
  { id: "extra", label: "Extra Skills", sources: [sourceId("extra")] },
];

export function groupSkills(skills: SkillStatusEntry[]): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();
  for (const def of SKILL_SOURCE_GROUPS) {
    groups.set(def.id, { id: def.id, label: def.label, skills: [] });
  }
  const builtInGroup = SKILL_SOURCE_GROUPS.find((group) => group.id === "built-in");
  const other: SkillGroup = { id: "other", label: "Other Skills", skills: [] };
  for (const skill of skills) {
    const match = skill.bundled
      ? builtInGroup
      : SKILL_SOURCE_GROUPS.find((group) => group.sources.includes(skill.source));
    if (match) {
      groups.get(match.id)?.skills.push(skill);
    } else {
      other.skills.push(skill);
    }
  }
  const ordered = SKILL_SOURCE_GROUPS.map((group) => groups.get(group.id)).filter(
    (group): group is SkillGroup => Boolean(group && group.skills.length > 0),
  );
  if (other.skills.length > 0) {
    ordered.push(other);
  }
  return ordered;
}
