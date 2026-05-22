import type { SkillScanFinding } from "./types.js";

const RULES: Array<{
  ruleId: string;
  severity: SkillScanFinding["severity"];
  pattern: RegExp;
  message: string;
}> = [
  {
    ruleId: "prompt-injection-ignore-instructions",
    severity: "critical",
    pattern: /ignore (all|any|previous|above|prior) instructions/i,
    message: "prompt-injection wording attempts to override higher-priority instructions",
  },
  {
    ruleId: "prompt-injection-system",
    severity: "critical",
    pattern: /\b(system prompt|developer message|hidden instructions)\b/i,
    message: "skill text references hidden prompt layers",
  },
  {
    ruleId: "prompt-injection-tool",
    severity: "critical",
    pattern:
      /\b(run|execute|invoke|call)\b.{0,50}\btool\b.{0,50}\bwithout\b.{0,30}\b(permission|approval)/i,
    message: "skill text encourages bypassing tool approval",
  },
  {
    ruleId: "shell-pipe-to-shell",
    severity: "critical",
    pattern: /\b(curl|wget)\b[^|\n]{0,120}\|\s*(sh|bash|zsh)\b/i,
    message: "skill text includes pipe-to-shell install pattern",
  },
  {
    ruleId: "secret-exfiltration",
    severity: "critical",
    pattern: /\b(process\.env|env)\b.{0,80}\b(fetch|curl|wget|http|https)\b/i,
    message: "skill text may exfiltrate environment variables",
  },
  {
    ruleId: "secret-literal-api-key",
    severity: "critical",
    pattern: /\b(?:api[_-]?key|token|password|secret)\b\s*[:=]\s*["']?[A-Za-z0-9_\-.]{16,}/i,
    message: "skill text appears to include a literal credential",
  },
  {
    ruleId: "secret-private-key",
    severity: "critical",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    message: "skill text includes private key material",
  },
  {
    ruleId: "memory-exfiltration",
    severity: "critical",
    pattern:
      /\b(read|cat|print|dump|export)\b.{0,60}\b(memory files?|MEMORY\.md|credentials?|secrets?)\b.{0,100}\b(send|post|upload|paste|share|exfiltrate)\b/i,
    message: "skill text encourages memory or secret exfiltration",
  },
  {
    ruleId: "destructive-delete",
    severity: "warn",
    pattern: /\brm\s+-rf\s+(\/|\$HOME|~|\.)/i,
    message: "skill text contains broad destructive delete command",
  },
  {
    ruleId: "unsafe-permissions",
    severity: "warn",
    pattern: /\bchmod\s+(-R\s+)?777\b/i,
    message: "skill text contains unsafe permission change",
  },
];

export function scanSkillContent(content: string): SkillScanFinding[] {
  return RULES.filter((rule) => rule.pattern.test(content)).map((rule) => ({
    severity: rule.severity,
    ruleId: rule.ruleId,
    message: rule.message,
  }));
}

export function assertSkillContentSafe(content: string): SkillScanFinding[] {
  const findings = scanSkillContent(content);
  const critical = findings.find((finding) => finding.severity === "critical");
  if (critical) {
    throw new Error(`unsafe skill content: ${critical.message}`);
  }
  return findings;
}
