import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<KovaConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
