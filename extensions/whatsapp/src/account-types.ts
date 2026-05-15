import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<KovaConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
