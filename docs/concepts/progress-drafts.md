---
summary: "Progress drafts: one visible work-in-progress message that updates while an agent runs"
read_when:
  - Configuring visible progress updates for long-running chat turns
  - Choosing between partial, block, and progress streaming modes
  - Explaining how Kova updates one channel message while work is in progress
  - Troubleshooting progress drafts, standalone progress messages, or finalization fallback
title: "Progress drafts"
---

Progress drafts keep long agent turns visible without filling the conversation
with temporary status messages.

When progress drafts are enabled, Kova creates one work-in-progress message only
after a turn proves it is doing real work. The draft is updated while the agent
reads, plans, calls tools, waits for approval, or applies patches. When the final
answer is ready, Kova edits that same message into the final answer when the
channel can do that safely.

```text
Working

Reading: docs/concepts/progress-drafts.md
Web Search: neural studio
Exec: pnpm test
```

Use progress drafts when users care more about what the agent is doing than
watching the answer text stream token by token.

## Quick start

Enable progress drafts per channel with `streaming.mode: "progress"`:

```json5
{
  channels: {
    telegram: {
      streaming: {
        mode: "progress",
      },
    },
  },
}
```

Kova waits until the run has useful work to report, shows a short label such as
`Working`, and adds compact progress lines as real run events arrive.

## What users see

A progress draft has two parts:

| Part           | Purpose                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| Label          | A short starter/status line such as `Working`, `Searching`, or `Testing`. |
| Progress lines | Compact run updates using the same tool display names as verbose output.  |

The label appears after meaningful work starts and either lasts long enough to
need a visible status or emits another work event. Plain text-only replies do
not show a progress draft.

Progress lines come from actual run events, including tool starts, item updates,
plans, approvals, command output, and patch summaries. The final answer replaces
the draft when possible. If the channel cannot safely edit the draft into the
final answer, Kova sends the final answer normally and cleans up or stops
updating the draft according to that channel's transport.

## Choose a mode

`channels.<channel>.streaming.mode` controls preview behavior:

| Mode       | Best for                         | What appears in chat                              |
| ---------- | -------------------------------- | ------------------------------------------------- |
| `off`      | Quiet channels                   | Only the final answer.                            |
| `partial`  | Watching answer text appear      | One draft edited with the latest answer text.     |
| `block`    | Larger answer-preview chunks     | One preview updated or appended in bigger chunks. |
| `progress` | Tool-heavy or long-running turns | One status draft, then the final answer.          |

Choose `progress` for tool-heavy work, `partial` when the answer text itself is
the useful progress signal, and `block` when you want larger preview chunks.

## Configure labels

Progress labels live under `channels.<channel>.streaming.progress`.

The default label is `auto`, which chooses from Kova's built-in label pool:

```text
Working
Building
Checking
Reading
Scanning
Running
Planning
Searching
Reviewing
Testing
Syncing
Loading
Writing
Updating
Inspecting
Routing
Preparing
Resolving
Verifying
Finalizing
```

Use a fixed label:

```json5
{
  channels: {
    discord: {
      streaming: {
        mode: "progress",
        progress: {
          label: "Investigating",
        },
      },
    },
  },
}
```

Use your own automatic label pool:

```json5
{
  channels: {
    discord: {
      streaming: {
        mode: "progress",
        progress: {
          label: "auto",
          labels: ["Checking", "Reading", "Testing", "Finishing"],
        },
      },
    },
  },
}
```

Hide the label and show only progress lines:

```json5
{
  channels: {
    discord: {
      streaming: {
        mode: "progress",
        progress: {
          label: false,
        },
      },
    },
  },
}
```

## Control progress lines

Progress lines are enabled by default in progress mode. To keep preview
streaming but hide tool-progress lines, set:

```json5
{
  channels: {
    telegram: {
      streaming: {
        mode: "progress",
        preview: {
          toolProgress: false,
        },
      },
    },
  },
}
```

Kova uses the same tool-detail setting as verbose output:

```json5
{
  agents: {
    defaults: {
      toolProgressDetail: "explain", // explain | raw
    },
  },
}
```

`"explain"` keeps drafts concise. `"raw"` includes more underlying command or
tool detail, which is useful while debugging but noisier in chat.

Limit how many lines stay visible:

```json5
{
  channels: {
    discord: {
      streaming: {
        mode: "progress",
        progress: {
          maxLines: 4,
        },
      },
    },
  },
}
```

## Channel notes

Telegram and Discord use draft messages that are edited while work is in
progress. Slack and Mattermost have their own preview transports with similar
progress behavior. If a final answer contains media, an error payload, or a
transport-specific reply that cannot safely replace the draft, Kova sends the
final answer through the normal delivery path instead.

More details: [Streaming and chunking](/concepts/streaming).
