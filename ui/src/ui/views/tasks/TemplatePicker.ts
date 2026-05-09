import { html } from "lit";
import type { TaskTemplate } from "./types.ts";

export function renderTemplatePicker(params: {
  templates: TaskTemplate[];
  onUse: (template: TaskTemplate) => void;
  onClose: () => void;
}) {
  return html`
    <div class="tasks-modal-backdrop" @click=${params.onClose}>
      <section class="tasks-modal" @click=${(event: Event) => event.stopPropagation()}>
        <div class="tasks-modal__header">
          <h2>Task Templates</h2>
          <button class="tasks-icon-btn" @click=${params.onClose} aria-label="Close">×</button>
        </div>
        <div class="template-grid">
          ${params.templates.map(
            (template) => html`
              <article class="template-card">
                <div class="template-card__icon">${template.icon}</div>
                <h3>${template.name}</h3>
                <p>${template.description}</p>
                <button class="btn btn--sm" @click=${() => params.onUse(template)}>
                  Use template
                </button>
              </article>
            `,
          )}
        </div>
      </section>
    </div>
  `;
}
