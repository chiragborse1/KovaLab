import fs from "node:fs";
import path from "node:path";
import { Type } from "typebox";
import type { KovaConfig } from "../../config/types.kova.js";
import { isPathInside } from "../../infra/path-guards.js";
import { openVerifiedFileSync } from "../../infra/safe-open-sync.js";
import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";
import type { SkillEntry, SkillEligibilityContext } from "../skills/types.js";
import { loadVisibleWorkspaceSkillEntries } from "../skills/workspace.js";
import type { AnyAgentTool } from "./common.js";
import { asToolParamsRecord, jsonResult, readStringParam, ToolInputError } from "./common.js";

const DEFAULT_SKILL_VIEW_MAX_BYTES = 256_000;
const SUPPORT_DIR_NAMES = ["references", "templates", "scripts", "assets"] as const;
const MAX_LINKED_FILES = 200;
const MAX_LINKED_FILE_DEPTH = 5;

type SupportDirName = (typeof SUPPORT_DIR_NAMES)[number];

export type SkillToolOptions = {
  workspaceDir: string;
  config?: KovaConfig;
  entries?: SkillEntry[];
  managedSkillsDir?: string;
  bundledSkillsDir?: string;
  agentId?: string;
  skillFilter?: string[];
  eligibility?: SkillEligibilityContext;
  sessionId?: string;
  maxFileBytes?: number;
};

export type SkillListItem = {
  name: string;
  description: string;
  path: string;
  skillDir: string;
  source?: string;
  primaryEnv?: string;
};

export type SkillViewPayload = SkillListItem & {
  success: true;
  filePath: string;
  content: string;
  linkedFiles: Record<SupportDirName, string[]>;
  hint: string;
};

const SkillsListToolSchema = Type.Object({
  query: Type.Optional(Type.String()),
  source: Type.Optional(Type.String()),
});

const SkillViewToolSchema = Type.Object({
  name: Type.String(),
  filePath: Type.Optional(Type.String()),
});

function normalizeSkillLookup(value: string): string {
  return normalizeLowercaseStringOrEmpty(value).replace(/[\s_]+/g, "-");
}

function loadSkillEntries(options: SkillToolOptions): SkillEntry[] {
  if (options.entries) {
    return options.entries.toSorted((left, right) =>
      left.skill.name.localeCompare(right.skill.name, "en"),
    );
  }
  return loadVisibleWorkspaceSkillEntries(options.workspaceDir, {
    config: options.config,
    managedSkillsDir: options.managedSkillsDir,
    bundledSkillsDir: options.bundledSkillsDir,
    skillFilter: options.skillFilter,
    agentId: options.agentId,
    eligibility: options.eligibility,
  }).toSorted((left, right) => left.skill.name.localeCompare(right.skill.name, "en"));
}

function toListItem(entry: SkillEntry): SkillListItem {
  return {
    name: entry.skill.name,
    description: entry.skill.description?.trim() ?? "",
    path: entry.skill.filePath,
    skillDir: entry.skill.baseDir,
    ...(entry.skill.source ? { source: entry.skill.source } : {}),
    ...(entry.metadata?.primaryEnv ? { primaryEnv: entry.metadata.primaryEnv } : {}),
  };
}

function findSkillEntry(entries: SkillEntry[], name: string): SkillEntry | undefined {
  const normalizedName = normalizeSkillLookup(name);
  return entries.find((entry) => {
    const skillName = entry.skill.name.trim();
    return (
      normalizeLowercaseStringOrEmpty(skillName) === normalizeLowercaseStringOrEmpty(name) ||
      normalizeSkillLookup(skillName) === normalizedName
    );
  });
}

function normalizeSkillRelativeFilePath(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    return "SKILL.md";
  }
  const trimmed = raw.trim();
  if (trimmed.includes("\0")) {
    throw new ToolInputError("filePath must not contain NUL bytes");
  }
  if (path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed)) {
    throw new ToolInputError("filePath must be relative to the skill directory");
  }
  const unified = trimmed.replaceAll("\\", "/");
  const normalized = path.posix.normalize(unified);
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new ToolInputError("filePath must stay inside the skill directory");
  }
  return normalized;
}

function formatRelativePath(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).split(path.sep).join("/");
}

function readSkillFile(params: { entry: SkillEntry; filePath?: string; maxFileBytes: number }): {
  relativePath: string;
  absolutePath: string;
  content: string;
} {
  const relativePath = normalizeSkillRelativeFilePath(params.filePath);
  const baseRealPath = fs.realpathSync(params.entry.skill.baseDir);
  const absolutePath = path.resolve(params.entry.skill.baseDir, ...relativePath.split("/"));
  if (!isPathInside(params.entry.skill.baseDir, absolutePath)) {
    throw new ToolInputError("filePath must stay inside the skill directory");
  }

  const opened = openVerifiedFileSync({
    filePath: absolutePath,
    rejectPathSymlink: true,
    maxBytes: params.maxFileBytes,
  });
  if (!opened.ok) {
    if (opened.reason === "path") {
      throw new ToolInputError(`skill file not found: ${relativePath}`);
    }
    throw new ToolInputError(`skill file could not be read safely: ${relativePath}`);
  }

  try {
    if (!isPathInside(baseRealPath, opened.path)) {
      throw new ToolInputError("filePath resolves outside the skill directory");
    }
    return {
      relativePath,
      absolutePath: opened.path,
      content: fs.readFileSync(opened.fd, "utf8"),
    };
  } finally {
    fs.closeSync(opened.fd);
  }
}

function collectLinkedFiles(entry: SkillEntry): Record<SupportDirName, string[]> {
  const baseDir = entry.skill.baseDir;
  let baseRealPath: string;
  try {
    baseRealPath = fs.realpathSync(baseDir);
  } catch {
    return {
      references: [],
      templates: [],
      scripts: [],
      assets: [],
    };
  }

  const result: Record<SupportDirName, string[]> = {
    references: [],
    templates: [],
    scripts: [],
    assets: [],
  };

  const walk = (dir: string, bucket: SupportDirName, depth: number) => {
    if (result[bucket].length >= MAX_LINKED_FILES || depth > MAX_LINKED_FILE_DEPTH) {
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .toSorted((left, right) => left.name.localeCompare(right.name, "en"));
    } catch {
      return;
    }
    for (const child of entries) {
      if (result[bucket].length >= MAX_LINKED_FILES) {
        return;
      }
      const childPath = path.join(dir, child.name);
      if (child.isSymbolicLink()) {
        continue;
      }
      if (child.isDirectory()) {
        walk(childPath, bucket, depth + 1);
        continue;
      }
      if (!child.isFile()) {
        continue;
      }
      try {
        const realPath = fs.realpathSync(childPath);
        if (!isPathInside(baseRealPath, realPath)) {
          continue;
        }
        result[bucket].push(formatRelativePath(baseDir, childPath));
      } catch {
        // Ignore unreadable support files in the discovery list. skill_view will
        // surface the concrete failure if the model explicitly requests one.
      }
    }
  };

  for (const bucket of SUPPORT_DIR_NAMES) {
    const dir = path.join(baseDir, bucket);
    try {
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        continue;
      }
    } catch {
      continue;
    }
    walk(dir, bucket, 0);
  }

  return result;
}

function applySkillTemplateVars(content: string, entry: SkillEntry, sessionId?: string): string {
  return content
    .replaceAll("{baseDir}", entry.skill.baseDir)
    .replaceAll("${KOVA_SKILL_DIR}", entry.skill.baseDir)
    .replaceAll("${KOVA_SESSION_ID}", sessionId ?? "");
}

export function loadSkillViewPayload(
  params: SkillToolOptions & { name: string; filePath?: string },
) {
  const entries = loadSkillEntries(params);
  const entry = findSkillEntry(entries, params.name);
  if (!entry) {
    const names = entries
      .slice(0, 20)
      .map((candidate) => candidate.skill.name)
      .join(", ");
    throw new ToolInputError(
      names
        ? `skill not found: ${params.name}. Available: ${names}`
        : `skill not found: ${params.name}`,
    );
  }

  const maxFileBytes = Math.max(1024, params.maxFileBytes ?? DEFAULT_SKILL_VIEW_MAX_BYTES);
  const file = readSkillFile({
    entry,
    filePath: params.filePath,
    maxFileBytes,
  });
  const item = toListItem(entry);
  return {
    ...item,
    success: true as const,
    filePath: file.relativePath,
    path: file.absolutePath,
    content: applySkillTemplateVars(file.content, entry, params.sessionId),
    linkedFiles: collectLinkedFiles(entry),
    hint: "Use linkedFiles as a map of support files. Call skill_view with filePath to load a specific support file before using it.",
  };
}

export function renderSkillInvocationPrompt(params: {
  payload: SkillViewPayload;
  userInput?: string;
}): string {
  const linked = SUPPORT_DIR_NAMES.flatMap((bucket) =>
    params.payload.linkedFiles[bucket].map((file) => `- ${file}`),
  );
  return [
    `Kova loaded the "${params.payload.name}" skill for this request.`,
    `Skill directory: ${params.payload.skillDir}`,
    `Skill file: ${params.payload.filePath}`,
    linked.length > 0
      ? ["Supporting files available via skill_view:", ...linked.slice(0, 40)].join("\n")
      : null,
    "Skill instructions:",
    params.payload.content.trim(),
    params.userInput?.trim() ? `User input:\n${params.userInput.trim()}` : null,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join("\n\n");
}

export function createSkillsListTool(options: SkillToolOptions): AnyAgentTool {
  return {
    label: "Skills List",
    name: "skills_list",
    description:
      "List skills currently visible to this agent. Use this before skill_view when you need a reusable procedure or local operating guide.",
    parameters: SkillsListToolSchema,
    execute: async (_toolCallId, rawParams) => {
      const params = asToolParamsRecord(rawParams);
      const query = readStringParam(params, "query");
      const source = readStringParam(params, "source");
      const queryNormalized = query ? normalizeSkillLookup(query) : undefined;
      const sourceNormalized = source ? normalizeLowercaseStringOrEmpty(source) : undefined;
      const skills = loadSkillEntries(options)
        .map(toListItem)
        .filter((skill) => {
          if (queryNormalized) {
            const haystack = `${skill.name} ${skill.description}`;
            if (!normalizeSkillLookup(haystack).includes(queryNormalized)) {
              return false;
            }
          }
          if (sourceNormalized) {
            return normalizeLowercaseStringOrEmpty(skill.source) === sourceNormalized;
          }
          return true;
        });
      return jsonResult({
        success: true,
        count: skills.length,
        skills,
        hint: "Call skill_view with a skill name to load full instructions or a linked support file.",
      });
    },
  };
}

export function createSkillViewTool(options: SkillToolOptions): AnyAgentTool {
  return {
    label: "Skill View",
    name: "skill_view",
    description:
      "Read a skill's full instructions or one support file under that skill directory. Paths are confined to the selected skill.",
    parameters: SkillViewToolSchema,
    execute: async (_toolCallId, rawParams) => {
      const params = asToolParamsRecord(rawParams);
      const name = readStringParam(params, "name", { required: true, label: "name" });
      const filePath = readStringParam(params, "filePath");
      return jsonResult(loadSkillViewPayload({ ...options, name, filePath }));
    },
  };
}
