import type {
  ButtonInteraction,
  CommandInteraction,
  StringSelectMenuInteraction,
} from "@buape/carbon";
import type { ChatCommandDefinition, CommandArgs } from "getkova/plugin-sdk/command-auth";
import type { KovaConfig } from "getkova/plugin-sdk/config-runtime";
import type { ResolvedAgentRoute } from "getkova/plugin-sdk/routing";
import type { ThreadBindingManager } from "./thread-bindings.js";

type DiscordConfig = NonNullable<KovaConfig["channels"]>["discord"];

export type DispatchDiscordCommandInteractionParams = {
  interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction;
  prompt: string;
  command: ChatCommandDefinition;
  commandArgs?: CommandArgs;
  cfg: KovaConfig;
  discordConfig: DiscordConfig;
  accountId: string;
  sessionPrefix: string;
  preferFollowUp: boolean;
  threadBindings: ThreadBindingManager;
  responseEphemeral?: boolean;
  suppressReplies?: boolean;
};

export type DispatchDiscordCommandInteractionResult = {
  accepted: boolean;
  effectiveRoute?: ResolvedAgentRoute;
};

export type DispatchDiscordCommandInteraction = (
  params: DispatchDiscordCommandInteractionParams,
) => Promise<DispatchDiscordCommandInteractionResult>;
