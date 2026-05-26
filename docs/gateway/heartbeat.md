---
summary: "Pulse background checks, quiet replies, and notification rules"
read_when:
  - Adjusting Pulse cadence or messaging
  - Deciding between Pulse and cron for scheduled tasks
title: "Pulse"
sidebarTitle: "Pulse"
---

<Note>
This page lives at `/gateway/heartbeat` for older links. New Kova config should use `agents.defaults.pulse` and `agents.list[].pulse`.
</Note>

Pulse runs **periodic agent turns** so Kova can quietly check for things that need attention, do small background upkeep, and only notify you when there is something useful to say.

Pulse is not a detached [background task](/automation/tasks). It is a scheduled agent turn; task records are for ACP runs, subagents, and isolated cron jobs.

## Quick Start

<Steps>
  <Step title="Pick a cadence">
    Leave Pulse enabled at the default cadence, or set `agents.defaults.pulse.every`.
  </Step>
  <Step title="Add PULSE.md">
    Keep `PULSE.md` empty for no model call, or add a tiny checklist/task block for background checks.
  </Step>
  <Step title="Choose delivery">
    `target: "none"` runs quietly. Use `target: "last"` or a channel id when Pulse should send alerts.
  </Step>
  <Step title="Keep it cheap">
    Use `lightContext: true` and `isolatedSession: true` when Pulse only needs `PULSE.md`.
  </Step>
</Steps>

```json5
{
  agents: {
    defaults: {
      pulse: {
        every: "30m",
        target: "last",
        directPolicy: "allow",
        lightContext: true,
        isolatedSession: true,
        // activeHours: { start: "08:00", end: "24:00" },
      },
    },
  },
}
```

## Defaults

- Cadence: `30m` by default. Use `0m` to disable.
- Prompt: `Read PULSE.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply with ONLY: NO_REPLY.`
- Quiet reply token: `NO_REPLY`.
- Existing `agents.defaults.heartbeat` and `agents.list[].heartbeat` configs still work as legacy aliases. If both are set, `pulse` wins.
- `PULSE.md` is preferred. Legacy `HEARTBEAT.md` is still read when `PULSE.md` is missing.

## Response Contract

- If nothing needs attention, reply with only `NO_REPLY`.
- For alerts, do not include `NO_REPLY`; return only the update text.
- Kova hides quiet Pulse replies from user-facing history and delivery surfaces.
- Legacy quiet acknowledgements from older setups are still accepted for compatibility, but new prompts should use `NO_REPLY`.

## Config

```json5
{
  agents: {
    defaults: {
      pulse: {
        every: "30m",
        model: "anthropic/claude-opus-4-6",
        session: "main",
        target: "last",
        to: "+15551234567",
        accountId: "ops-bot",
        prompt: "Read PULSE.md if it exists. If nothing needs attention, reply with ONLY: NO_REPLY.",
        ackMaxChars: 300,
        suppressToolErrorWarnings: true,
        timeoutSeconds: 45,
        lightContext: true,
        isolatedSession: true,
        includeReasoning: false,
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        pulse: {
          every: "1h",
          target: "telegram",
          to: "12345678:topic:42",
        },
      },
    ],
  },
}
```

### Scope And Precedence

- `agents.defaults.pulse` sets shared Pulse behavior.
- `agents.list[].pulse` merges on top for that agent.
- If any agent has a `pulse` block, only those agents run Pulse.
- Legacy `heartbeat` blocks merge first; `pulse` blocks override them.
- Channel visibility still uses the existing `channels.*.heartbeat` keys for compatibility.

## PULSE.md

If `PULSE.md` exists and is effectively empty, Kova skips the Pulse model call and reports `reason=empty-heartbeat-file` internally. Empty means blank lines, markdown headings, code fences, or empty checkbox/list stubs only.

Keep `PULSE.md` small. It is prompt context.

```md
# Pulse checklist

- Quick scan: anything urgent in inboxes?
- Check whether calendar events in the next 24 hours need prep.
- If a task is blocked, note the blocker and ask the operator next time.
```

### Task Blocks

`PULSE.md` can hold a structured `tasks:` block. Kova includes only due tasks in the Pulse prompt.

```md
tasks:

- name: inbox-triage
  interval: 30m
  prompt: "Check for urgent unread emails and flag anything time sensitive."
- name: calendar-scan
  interval: 2h
  prompt: "Check for upcoming meetings that need prep or follow-up."

# Additional instructions

- Keep alerts short.
- If nothing needs attention after all due tasks, reply NO_REPLY.
```

Task last-run timestamps are stored in session state. Skipped empty/no-due-task runs do not mark tasks complete.

## Manual Wake

Run Pulse now:

```bash
kova system event --text "Check for urgent follow-ups" --mode now
```

Wait for the next Pulse tick:

```bash
kova system event --text "Check for urgent follow-ups" --mode next-pulse
```

Controls:

```bash
kova system pulse last
kova system pulse enable
kova system pulse disable
```

`kova system heartbeat ...` remains a legacy alias.

## Delivery

- `target: "none"` runs Pulse without external delivery.
- `target: "last"` sends useful alerts to the last external chat for the session.
- `target: "<channel>"` sends to a configured channel when `to` is set.
- `directPolicy: "block"` suppresses direct/DM sends while still allowing Pulse to run.
- If the main queue is busy, Pulse skips and retries later.

Visibility config remains on the existing channel heartbeat keys:

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
```

`showOk` sends a small "Pulse quiet." message when the model returns a quiet reply. Most users should leave it off.

## Cost Awareness

Pulse runs model calls. To reduce cost:

- Use `isolatedSession: true` to avoid sending full conversation history.
- Use `lightContext: true` to inject only `PULSE.md` / legacy `HEARTBEAT.md`.
- Use a cheaper `model` for Pulse.
- Keep `PULSE.md` short.
- Use `target: "none"` if you only want internal upkeep.

## Related

- [Automation & Tasks](/automation)
- [Background Tasks](/automation/tasks)
- [Timezone](/concepts/timezone)
- [Troubleshooting](/automation/cron-jobs#troubleshooting)
