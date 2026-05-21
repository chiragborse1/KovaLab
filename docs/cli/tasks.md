---
summary: "CLI reference for `kova tasks` (background task ledger and Task Flow state)"
read_when:
  - You want to inspect, audit, or cancel background task records
  - You are documenting Task Flow commands under `kova tasks flow`
title: "`kova tasks`"
---

Inspect durable background tasks and Task Flow state. With no subcommand,
`kova tasks` is equivalent to `kova tasks list`.

See [Background Tasks](/automation/tasks) for the lifecycle and delivery model.

## Usage

```bash
kova tasks
kova tasks list
kova tasks list --runtime acp
kova tasks list --status running
kova tasks show <lookup>
kova tasks notify <lookup> state_changes
kova tasks cancel <lookup>
kova tasks report
kova tasks audit
kova tasks maintenance
kova tasks maintenance --apply
kova tasks flow list
kova tasks flow show <lookup>
kova tasks flow cancel <lookup>
```

## Root Options

- `--json`: output JSON.
- `--runtime <name>`: filter by kind: `subagent`, `acp`, `cron`, or `cli`.
- `--status <name>`: filter by status: `queued`, `running`, `succeeded`, `failed`, `timed_out`, `cancelled`, or `lost`.

## Subcommands

### `list`

```bash
kova tasks list [--runtime <name>] [--status <name>] [--json]
```

Lists tracked background tasks newest first.

### `show`

```bash
kova tasks show <lookup> [--json]
```

Shows one task by task ID, run ID, or session key.

### `notify`

```bash
kova tasks notify <lookup> <done_only|state_changes|silent>
```

Changes the notification policy for a running task.

### `cancel`

```bash
kova tasks cancel <lookup>
```

Cancels a running background task.

### `audit`

```bash
kova tasks audit [--severity <warn|error>] [--code <name>] [--limit <n>] [--json]
```

Surfaces stale, lost, delivery-failed, or otherwise inconsistent task and Task Flow records. Lost tasks retained until `cleanupAfter` are warnings; expired or unstamped lost tasks are errors.

### `report`

```bash
kova tasks report [--runtime <name>] [--status <name>] [--limit <n>] [--json]
```

Prints a lightweight background automation report from the existing task ledger and Task Flow records. The report includes task status/runtime counts, delivery state, Task Flow counts, audit totals, completed-task duration stats, active task rows, and recent failed/lost/delivery-failed tasks. It does not rerun work.

### `maintenance`

```bash
kova tasks maintenance [--apply] [--json]
```

Previews or applies task and Task Flow reconciliation, cleanup stamping, and pruning.
For cron tasks, reconciliation uses persisted run logs/job state before marking an
old active task `lost`, so completed cron runs do not become false audit errors
just because the in-memory Gateway runtime state is gone. Offline CLI audit is
not authoritative for the Gateway's process-local cron active-job set.

### `flow`

```bash
kova tasks flow list [--status <name>] [--json]
kova tasks flow show <lookup> [--json]
kova tasks flow cancel <lookup>
```

Inspects or cancels durable Task Flow state under the task ledger.

## Related

- [CLI reference](/cli)
- [Background tasks](/automation/tasks)
