import fs from "node:fs";
import type { ChannelLegacyStateMigrationPlan } from "getkova/plugin-sdk/channel-contract";
import { resolveChannelAllowFromPath } from "getkova/plugin-sdk/channel-pairing-paths";
import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import { resolveDefaultTelegramAccountId } from "./account-selection.js";

function fileExists(pathValue: string): boolean {
  try {
    return fs.existsSync(pathValue) && fs.statSync(pathValue).isFile();
  } catch {
    return false;
  }
}

export function detectTelegramLegacyStateMigrations(params: {
  cfg: KovaConfig;
  env: NodeJS.ProcessEnv;
}): ChannelLegacyStateMigrationPlan[] {
  const legacyPath = resolveChannelAllowFromPath("telegram", params.env);
  if (!fileExists(legacyPath)) {
    return [];
  }
  const accountId = resolveDefaultTelegramAccountId(params.cfg);
  const targetPath = resolveChannelAllowFromPath("telegram", params.env, accountId);
  if (fileExists(targetPath)) {
    return [];
  }
  return [
    {
      kind: "copy",
      label: "Telegram pairing allowFrom",
      sourcePath: legacyPath,
      targetPath,
    },
  ];
}
