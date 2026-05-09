# Tasks View

## What Was Built

The Tasks sidebar route now renders a complete task tracker surface:

- Header with status filters, counts, view toggle, and `+ New Task`.
- Board view with queued, running, completed, failed, and needs-approval columns.
- List view with client-side sorting.
- New Task drawer with schedule, recurring cron builder, context, follow-up, and model override sections.
- Task detail drawer with overview, output, and timeline tabs.
- Template picker modal and zero-task empty state.

## Mock To Real API Swap

Task data currently comes from `mockData.ts`. The top-level `TASKS_API_MODE` flag and TODO mark the seam for replacing mock calls with gateway RPC calls once a tasks endpoint exists.

The expected swap is:

- Replace `createInitialTasks()` with a gateway-backed task list request.
- Replace `tickMockTasks()` with a refresh request for running tasks.
- Replace local create/retry/approve/reject/cancel/delete mutations with gateway RPC calls, then refresh the board.

No component needs to change if the real API returns the `Task` shape in `types.ts`.

## Polling

`TasksPage.ts` owns the polling interval. It refreshes running mock tasks every `3000ms` in `connectedCallback()` and clears the interval in `disconnectedCallback()`.

Change the interval in `TasksPage.ts` if the gateway endpoint needs a different refresh cadence.
