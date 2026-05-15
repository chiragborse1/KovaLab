import type { RuntimeEnv } from "../runtime.js";
import { type WizardPrompter } from "../wizard/prompts.js";
import type { ConfigureWizardParams } from "./configure.shared.js";
export declare function runConfigureWizard(opts: ConfigureWizardParams, runtime?: RuntimeEnv, injectedPrompter?: WizardPrompter): Promise<void>;
