import { html, nothing } from "lit";
import type { SkillStatusEntry } from "../types.ts";

export function computeSkillMissing(skill: SkillStatusEntry): string[] {
  return [
    ...skill.missing.bins.map((b) => `bin:${b}`),
    ...skill.missing.env.map((e) => `env:${e}`),
    ...skill.missing.config.map((c) => `config:${c}`),
    ...skill.missing.os.map((o) => `os:${o}`),
  ];
}

export function computeSkillReasons(skill: SkillStatusEntry): string[] {
  const reasons: string[] = [];
  if (skill.disabled) {
    reasons.push("disabled");
  }
  if (skill.blockedByAllowlist) {
    reasons.push("blocked by allowlist");
  }
  return reasons;
}

export function formatSkillSourceLabel(source: string) {
  const normalized = source.trim();
  if (!normalized) {
    return "kova";
  }
  return normalized.replace(/^openclaw-/, "kova-");
}

export function renderSkillStatusChips(params: {
  skill: SkillStatusEntry;
  showBundledBadge?: boolean;
}) {
  const skill = params.skill;
  const showBundledBadge = Boolean(params.showBundledBadge);
  const missing = computeSkillMissing(skill);
  const blockedReason = [
    ...missing.map((entry) => `Missing ${entry}`),
    ...computeSkillReasons(skill),
  ].join("; ");
  return html`
    <div class="chip-row" style="margin-top: 6px;">
      <span class="chip">${formatSkillSourceLabel(skill.source)}</span>
      ${showBundledBadge ? html` <span class="chip">bundled</span> ` : nothing}
      <span
        class="chip ${skill.eligible ? "chip-ok" : "chip-warn"}"
        title=${skill.eligible ? "Ready to use" : blockedReason || "Blocked"}
      >
        ${skill.eligible ? "ready" : "blocked"}
      </span>
      ${skill.disabled ? html` <span class="chip chip-warn">disabled</span> ` : nothing}
    </div>
  `;
}
