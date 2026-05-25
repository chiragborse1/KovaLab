---
summary: "CLI reference for terminal chat and compatibility TUI commands"
read_when:
  - You want a terminal UI for the Gateway (remote-friendly)
  - You want to pass url/token/session from scripts
  - You want to run the TUI in local embedded mode without a Gateway
  - You want to use kova or a compatibility TUI command
title: "TUI"
---

# Terminal chat

Open Kova's terminal UI with `kova`. That is the canonical local embedded path.
The hidden compatibility command `kova tui` can still connect to a running
Gateway for remote or always-on sessions.

Related:

- TUI guide: [TUI](/web/tui)

Notes:

- `kova` is the default local terminal chat command.
- `chat`, `terminal`, and `tui --local` remain compatibility paths.
- Local mode is the fastest first chat path and does not require the Gateway or Control UI.
- `--local` cannot be combined with `--url`, `--token`, or `--password`.
- `tui` resolves configured gateway auth SecretRefs for token/password auth when possible (`env`/`file`/`exec` providers).
- When launched from inside a configured agent workspace directory, TUI auto-selects that agent for the session key default (unless `--session` is explicitly `agent:<id>:...`).
- Local mode uses an isolated local backend worker for the embedded agent runtime. Most local tools work, but Gateway-only features are unavailable.
- Local mode adds `/auth [provider]` inside the TUI command surface.
- Plugin approval gates still apply in local mode. Tools that require approval prompt for a decision in the terminal; nothing is silently auto-approved because the Gateway is not involved.
- `/help` opens the terminal command center with core navigation, run controls, Gateway status, tools, context, memory, skills, and plugin commands.
- `/tools` and `/skills` render compact terminal catalogs locally; use `verbose` when you need names and short descriptions.
- `/tasks`, `/subagents`, and `/automation` render durable background work directly from the task runtime, so you can inspect detached agent runs without spending an LLM turn.
- `/recover` audits task and TaskFlow state, previews safe maintenance, and `/recover apply` reconciles stale/lost records and prunes old terminal work.
- `/verbose` cycles compact tool activity; `/details expanded` shows tool output.
- Tool rail durations measure actual tool runtime, not the full model/planning
  wait before a tool starts. If that earlier phase is slow, the status line
  calls it out as model/provider waiting.
- Set `KOVA_TUI_TRACE=1` when you need per-turn local timing diagnostics and a slowest-segment summary for slow replies.

## Examples

```bash
kova
# compatibility paths when you need advanced flags
kova tui --local --history-limit 30
kova tui --local --message "Compare my config to the docs and tell me what to fix"
# Gateway-backed TUI
kova tui --url ws://127.0.0.1:18789 --token <token>
kova tui --session main --deliver
# inside the TUI, open matching sessions
/sessions research
# inspect background agent work without asking the model
/subagents
/tasks audit
/recover
```

## Config repair loop

Use local mode when the current config already validates and you want the local
agent worker to inspect it, compare it against the docs, and help repair it from
the same terminal:

If `kova config validate` is already failing, use `kova configure` or
`kova doctor --fix` first. `kova` does not bypass the invalid-
config guard.

```bash
kova
```

Then inside the TUI:

```text
/help
!kova config file
!kova docs gateway auth token secretref
!kova config validate
!kova doctor
```

Apply targeted fixes with `kova config set` or `kova configure`, then
rerun `kova config validate`. See [TUI](/web/tui) and [Config](/cli/config).

## Related

- [CLI reference](/cli)
- [TUI](/web/tui)
