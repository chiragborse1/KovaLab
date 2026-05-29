import { normalizeOptionalString } from "../../shared/string-coerce.js";
import type { Skill } from "./skill-contract.js";
import type { SkillTelemetrySource } from "./types.js";

type SkillSourceCompat = Skill & {
  sourceInfo?: {
    source?: string;
  };
};

export function resolveSkillSource(skill: Skill): string {
  const compatSkill = skill as SkillSourceCompat;
  const canonical = normalizeOptionalString(compatSkill.source) ?? "";
  if (canonical) {
    return canonical;
  }
  const legacy = normalizeOptionalString(compatSkill.sourceInfo?.source) ?? "";
  return legacy || "unknown";
}

export function resolveSkillTelemetrySourceValue(value: unknown): SkillTelemetrySource {
  const source = normalizeOptionalString(value) ?? "";
  if (source === "bundled" || source === "kova-bundled") {
    return "bundled";
  }
  if (
    source === "workspace" ||
    source === "kova-workspace" ||
    source === "kova-managed" ||
    source === "kova-extra" ||
    source === "agents-skills-personal" ||
    source === "agents-skills-project"
  ) {
    return "workspace";
  }
  return "unknown";
}

export function resolveSkillTelemetrySource(skill: Skill): SkillTelemetrySource {
  return resolveSkillTelemetrySourceValue(resolveSkillSource(skill));
}
