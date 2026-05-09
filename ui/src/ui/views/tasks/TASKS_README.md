# Tasks View

## What Was Built

The Tasks sidebar route now renders a complete task tracker surface:

- Header with status filters, counts, view toggle, and `+ New Task`.
- Board view with queued, running, completed, failed, and needs-approval columns.
- List view with client-side sorting.
- New Task drawer with schedule, recurring cron builder, context, follow-up, and model override sections.
- Task detail drawer with overview, output, and timeline tabs.
- Template picker modal and zero-task empty state.

## Gateway Data

Task data is loaded from the Gateway task ledger through `tasks.list`.

The UI maps Gateway task records in `gatewayData.ts`:

- Gateway statuses `succeeded`, `failed`, `timed_out`, `cancelled`, and `lost` are folded into the board columns.
- Gateway runtimes `cli`, `cron`, `acp`, and `subagent` are mapped to user-facing source chips.
- Output and timeline are synthesized from the durable task summaries because the ledger does not store full transcript streams.

New immediate tasks use the existing `agent` RPC, which already creates a `cli` task record when a session key is present. Scheduled and recurring tasks use `cron.add`; their task records appear when Cron executes the job.

## Polling

`TasksPage.ts` owns the polling interval. It refreshes the Gateway ledger every `3000ms` in `connectedCallback()` and clears the interval in `disconnectedCallback()`.

Change the interval in `TasksPage.ts` if the gateway endpoint needs a different refresh cadence.
