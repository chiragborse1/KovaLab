export const DEFAULT_TAGLINE = "terminal agent ready";
export type TaglineMode = "random" | "default" | "off";

export const TAGLINES: string[] = [
  DEFAULT_TAGLINE,
  "local-first agent ready",
  "workspace ready",
  "chat first, extras when needed",
  "tools ready when you approve them",
];

type HolidayRule = (date: Date) => boolean;

// Kept for API compatibility with older plugin/test imports. Kova no longer
// changes startup copy for holidays; startup should stay predictable.
export const HOLIDAY_RULES = new Map<string, HolidayRule>();

export interface TaglineOptions {
  env?: NodeJS.ProcessEnv;
  random?: () => number;
  now?: () => Date;
  mode?: TaglineMode;
}

export function activeTaglines(_options: TaglineOptions = {}): string[] {
  return TAGLINES;
}

export function pickTagline(options: TaglineOptions = {}): string {
  const mode = options.mode ?? "default";
  if (mode === "off") {
    return "";
  }
  if (mode === "default") {
    return DEFAULT_TAGLINE;
  }

  const env = options.env ?? process.env;
  const override = env?.KOVA_TAGLINE_INDEX;
  if (override !== undefined) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return TAGLINES[parsed % TAGLINES.length] ?? DEFAULT_TAGLINE;
    }
  }

  const rand = options.random ?? Math.random;
  const index = Math.floor(rand() * TAGLINES.length) % TAGLINES.length;
  return TAGLINES[index] ?? DEFAULT_TAGLINE;
}
