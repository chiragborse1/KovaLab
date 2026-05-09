import { html, nothing } from "lit";
import { icons } from "../../icons.ts";
import type { SessionConversationMessage } from "./types.ts";

export function renderSessionConversation(params: {
  loading: boolean;
  error: string | null;
  messages: SessionConversationMessage[] | null;
  onRetry: () => void;
  onOpenChat: () => void;
}) {
  if (params.loading) {
    return html`
      <div class="sessions-conversation">
        <div class="sessions-skeleton-row"></div>
        <div class="sessions-skeleton-row" style="height: 68px; width: 78%;"></div>
        <div
          class="sessions-skeleton-row"
          style="height: 82px; width: 86%; justify-self: end;"
        ></div>
      </div>
    `;
  }
  if (params.error) {
    return html`
      <div class="sessions-empty">
        ${icons.alertTriangle}
        <strong>Conversation history failed to load</strong>
        <span>${params.error}</span>
        <button class="btn" @click=${params.onRetry}>Retry</button>
      </div>
    `;
  }
  if (!params.messages || params.messages.length === 0) {
    return html`
      <div class="sessions-empty">
        ${icons.messageSquare}
        <strong>No conversation history available for this session</strong>
        <span>Open the session in Chat to inspect or continue the thread.</span>
        <button class="btn primary" @click=${params.onOpenChat}>Open in Chat</button>
      </div>
    `;
  }
  return html`
    <div class="sessions-conversation">
      ${params.messages.map(
        (message) => html`
          <div class=${`session-message ${message.role}`}>
            ${message.role === "tool" && message.toolName
              ? html`<strong>Tool: ${message.toolName}</strong><br />`
              : nothing}
            ${message.text}
          </div>
        `,
      )}
    </div>
  `;
}
