import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<KovaConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
