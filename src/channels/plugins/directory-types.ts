import type { KovaConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: KovaConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
