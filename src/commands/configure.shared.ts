import {
  confirm as clackConfirm,
  intro as clackIntro,
  outro as clackOutro,
  select as clackSelect,
  text as clackText,
} from "@clack/prompts";
import { normalizeStringEntries } from "../shared/string-normalization.js";
import { stylePromptHint, stylePromptMessage, stylePromptTitle } from "../terminal/prompt-style.js";
import type { WizardPrompter, WizardSelectOption } from "../wizard/prompts.js";

export const CONFIGURE_WIZARD_SECTIONS = [
  "workspace",
  "model",
  "web",
  "gateway",
  "daemon",
  "channels",
  "plugins",
  "skills",
  "health",
] as const;

export type WizardSection = (typeof CONFIGURE_WIZARD_SECTIONS)[number];

export function parseConfigureWizardSections(raw: unknown): {
  sections: WizardSection[];
  invalid: string[];
} {
  const sectionsRaw: string[] = Array.isArray(raw) ? normalizeStringEntries(raw) : [];
  if (sectionsRaw.length === 0) {
    return { sections: [], invalid: [] };
  }

  const invalid = sectionsRaw.filter((s) => !CONFIGURE_WIZARD_SECTIONS.includes(s as never));
  const sections = sectionsRaw.filter((s): s is WizardSection =>
    CONFIGURE_WIZARD_SECTIONS.includes(s as never),
  );
  return { sections, invalid };
}

export type ChannelsWizardMode = "configure" | "remove";

export type ConfigureWizardParams = {
  command: "configure" | "update";
  sections?: WizardSection[];
  deferConfigReload?: boolean;
  allowServiceActions?: boolean;
};

export const CONFIGURE_SECTION_OPTIONS: Array<{
  value: WizardSection;
  label: string;
  hint: string;
}> = [
  { value: "workspace", label: "Workspace", hint: "Set workspace + sessions" },
  { value: "model", label: "Model", hint: "Pick provider + credentials" },
  { value: "web", label: "Web tools", hint: "Configure web search (Perplexity/Brave) + fetch" },
  { value: "gateway", label: "Gateway", hint: "Port, bind, auth, tailscale" },
  {
    value: "daemon",
    label: "Daemon",
    hint: "Install/manage the background service",
  },
  {
    value: "channels",
    label: "Channels",
    hint: "Link WhatsApp/Telegram/etc and defaults",
  },
  { value: "plugins", label: "Plugins", hint: "Configure plugin settings (sandbox, tools, etc.)" },
  { value: "skills", label: "Skills", hint: "Install/enable workspace skills" },
  {
    value: "health",
    label: "Health check",
    hint: "Run gateway + channel checks",
  },
];

let activeConfigurePrompter: WizardPrompter | null = null;

export async function withConfigurePrompter<T>(
  prompter: WizardPrompter,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = activeConfigurePrompter;
  activeConfigurePrompter = prompter;
  try {
    return await fn();
  } finally {
    activeConfigurePrompter = previous;
  }
}

export const intro = (message: string) => {
  if (activeConfigurePrompter) {
    return activeConfigurePrompter.intro(message);
  }
  return clackIntro(stylePromptTitle(message) ?? message);
};

export const outro = (message: string) => {
  if (activeConfigurePrompter) {
    return activeConfigurePrompter.outro(message);
  }
  return clackOutro(stylePromptTitle(message) ?? message);
};

export const text = (params: Parameters<typeof clackText>[0]) => {
  if (activeConfigurePrompter) {
    return activeConfigurePrompter.text({
      message: String(params.message),
      ...(typeof params.initialValue === "string" ? { initialValue: params.initialValue } : {}),
      ...(typeof params.placeholder === "string" ? { placeholder: params.placeholder } : {}),
      ...(params.validate
        ? { validate: (value: string) => params.validate?.(value) as string | undefined }
        : {}),
    });
  }
  return clackText({
    ...params,
    message: stylePromptMessage(params.message),
  });
};

export const confirm = (params: Parameters<typeof clackConfirm>[0]) => {
  if (activeConfigurePrompter) {
    return activeConfigurePrompter.confirm({
      message: String(params.message),
      ...(typeof params.initialValue === "boolean" ? { initialValue: params.initialValue } : {}),
    });
  }
  return clackConfirm({
    ...params,
    message: stylePromptMessage(params.message),
  });
};

export const select = <T>(params: Parameters<typeof clackSelect<T>>[0]) => {
  if (activeConfigurePrompter) {
    return activeConfigurePrompter.select<T>({
      message: String(params.message),
      options: params.options.map((opt) => {
        const base: WizardSelectOption<T> = {
          value: opt.value,
          label: opt.label ?? String(opt.value),
        };
        return opt.hint === undefined ? base : { ...base, hint: String(opt.hint) };
      }),
      ...(params.initialValue !== undefined ? { initialValue: params.initialValue } : {}),
    });
  }
  return clackSelect({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });
};
