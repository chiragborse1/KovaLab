import { html } from "lit";

export function renderTaskEmptyState(params: {
  onCreate: () => void;
  onTemplates: () => void;
  onImportCron: () => void;
}) {
  return html`
    <section class="tasks-empty-state">
      <div class="tasks-empty-state__icon">⚡</div>
      <h2>Tasks run Kova on autopilot</h2>
      <p>
        Every job your agents run — manual, scheduled, or triggered — appears here as a tracked,
        inspectable task with live output, cost, and history.
      </p>
      <div class="tasks-empty-state__actions">
        <button class="btn primary" @click=${params.onCreate}>+ Create your first task</button>
        <button class="btn" @click=${params.onTemplates}>Browse templates</button>
        <button class="btn" @click=${params.onImportCron}>Import from Cron Jobs</button>
      </div>
    </section>
  `;
}
