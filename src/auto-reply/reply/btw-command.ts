import { normalizeOptionalString } from "../../shared/string-coerce.js";
import { normalizeCommandBody, type CommandNormalizeOptions } from "../commands-registry.js";

const BTW_COMMAND_RE = /^\/btw(?::|\s|$)/i;
const BTW_QUESTION_RE = /^\/btw(?:(?::|\s+)([\s\S]*))?$/i;

function listBtwCommandCandidates(text: string, options?: CommandNormalizeOptions): string[] {
  const trimmed = text.trim();
  const normalized = normalizeCommandBody(trimmed, options).trim();
  return normalized === trimmed ? [normalized] : [normalized, trimmed];
}

export function isBtwRequestText(text?: string, options?: CommandNormalizeOptions): boolean {
  if (!text) {
    return false;
  }
  return listBtwCommandCandidates(text, options).some((candidate) =>
    BTW_COMMAND_RE.test(candidate),
  );
}

export function extractBtwQuestion(
  text?: string,
  options?: CommandNormalizeOptions,
): string | null {
  if (!text) {
    return null;
  }
  for (const candidate of listBtwCommandCandidates(text, options)) {
    const match = candidate.match(BTW_QUESTION_RE);
    if (match) {
      return normalizeOptionalString(match[1]) ?? "";
    }
  }
  return null;
}
