---
summary: "Create, inspect, advance, and cancel durable terminal goals"
read_when:
  - Creating persistent goals from the terminal
  - Inspecting goal progress backed by Task Flow
  - Managing goal state without starting a chat turn
title: "CLI: goals"
---

`kova goals` is a terminal-first facade over managed [Task Flow](/automation/taskflow)
records. Use it when you want a durable goal ledger that survives restarts and
can link child background tasks without starting a new agent turn.

Goals are intentionally small: they track goal text, status, current step,
owner session, linked tasks, and terminal outcome. They do not bypass tool
approval, task cancellation, or session ownership rules.

## Commands

```bash
# List active goals
kova goals
kova goals list

# Include finished goals
kova goals list --all

# Create a durable goal for the default main session
kova goals add "Ship the fast terminal loop" --step "plan"

# Attach a goal to a specific agent main session
kova goals add "Investigate provider cooldowns" --agent main

# Inspect one goal
kova goals show <goal-id>

# Advance active progress
kova goals set <goal-id> --status running --step "collect evidence"

# Mark terminal outcomes explicitly
kova goals done <goal-id>
kova goals fail <goal-id> --reason "judge rejected final answer"
kova goals cancel <goal-id>
```

All commands that print state support `--json`.

## Status model

`goals set` only accepts active states:

- `queued`
- `running`
- `waiting`
- `blocked`

Terminal states are explicit commands:

- `goals done` -> `succeeded`
- `goals fail` -> `failed`
- `goals cancel` -> `cancelled`

This keeps destructive or final state transitions visible in terminal history.

## Relationship to tasks

Every goal is stored as a managed Task Flow with controller `cli/goals`. Child
background tasks can link to the flow, and the goal detail view shows task
counts and linked task rows. Use [`kova tasks`](/cli/tasks) when you need the
lower-level task ledger, and use [`kova tasks flow`](/automation/taskflow) when
you need all Task Flow records, including non-goal flows.
