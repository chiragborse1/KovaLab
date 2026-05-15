export const KOVA_OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const KOVA_OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  KOVA_OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isKovaOwnerOnlyCoreToolName(toolName: string): boolean {
  return KOVA_OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
