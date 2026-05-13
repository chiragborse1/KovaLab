import { normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";
import { normalizeWebhookPath } from "openclaw/plugin-sdk/webhook-path";
//#region extensions/bluebubbles/src/webhook-shared.ts
const DEFAULT_WEBHOOK_PATH = "/bluebubbles-webhook";
function resolveWebhookPathFromConfig(config) {
	const raw = normalizeOptionalString(config?.webhookPath);
	if (raw) return normalizeWebhookPath(raw);
	return DEFAULT_WEBHOOK_PATH;
}
//#endregion
export { normalizeWebhookPath as n, resolveWebhookPathFromConfig as r, DEFAULT_WEBHOOK_PATH as t };
