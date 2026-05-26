---
summary: "Terminal UI (TUI): run Kova locally or connect to the Gateway"
read_when:
  - You want a beginner-friendly walkthrough of the TUI
  - You need the complete list of TUI features, commands, and shortcuts
title: "TUI"
---

## Quick start

### Local mode

Run the terminal product without a Gateway:

```bash
kova
```

This is the default interactive path. It uses an isolated local backend worker
for the embedded agent runtime, so first chat does not depend on the Gateway, a
browser, or any chat channel.

Notes:

- `kova` is the canonical local terminal chat entry.
- Older local aliases remain available only for compatibility.
- `--local` cannot be combined with `--url`, `--token`, or `--password`.
- Most local tools work in embedded mode, but Gateway-only remote delivery features are unavailable.
- Bare `kova` opens the local terminal chat path.
- Plugin approval gates still apply in local mode. Tools that require approval prompt for a decision in the terminal; nothing is silently auto-approved because the Gateway is not involved.
- Set `KOVA_TUI_IN_PROCESS_BACKEND=1` only when debugging the legacy in-process local backend.
- Set `KOVA_TUI_TRACE=1` to print per-turn local timing diagnostics and a slowest-segment summary while investigating slow replies.

### Gateway mode

1. Start the Gateway.

```bash
kova gateway
```

2. Open the remote TUI compatibility command.

```bash
kova tui
```

3. Type a message and press Enter.

Remote Gateway:

```bash
kova tui --url ws://<host>:<port> --token <gateway-token>
```

Use `--password` if your Gateway uses password auth.

## What you see

- Header: compact control deck with connection state, activity, current model, context gauge, agent/session, tools, and skills.
- Chat log: user prompts, assistant replies, system notices, compact tool activity.
- Approval cards: exec/tool approval requests stay visible even when tool
  details are hidden; run `/approve` to choose a pending request, or respond
  with the shown `/approve ...` command.
- Status line: connection/run state (connecting, running, streaming, idle, error).
- Footer: compact `agent/session`, active mode flags, queued messages, and `ctx used/limit`.
- Input: text editor with autocomplete.

The chat transcript uses a compact command-log style: user turns start with `❯`,
assistant turns start with `●`, and tool activity appears as nearby `●` rows with
short action labels, target details, and runtime. Expanded tool output is nested
under the tool row with `└`. The duration on each tool line is only the tool's
runtime after Kova receives the tool-start event. If a turn takes time before the
first tool appears, the status line now says whether Kova is waiting on the
model/provider or running a tool. Use `KOVA_TUI_TRACE=1 kova` for the full
per-turn timing breakdown when a reply feels slow.

The `ctx` gauge is the current session's estimated model context usage. When it
gets close to the selected model's context limit, Kova needs compaction or a new
session before the model can keep working reliably. It is not your provider
account quota or daily/monthly model limit. Use `/limits` for the in-terminal
explanation, and `kova status --usage` when a provider exposes quota or usage
snapshots.

## Mental model: agents + sessions

- Agents are unique slugs (e.g. `main`, `research`). The Gateway exposes the list.
- Sessions belong to the current agent.
- Session keys are stored as `agent:<agentId>:<sessionKey>`.
  - If you type `/session main`, the TUI expands it to `agent:<currentAgent>:main`.
  - If you type `/session agent:other:main`, you switch to that agent session explicitly.
- Session scope:
  - `per-sender` (default): each agent has many sessions.
  - `global`: the TUI always uses the `global` session (the picker may be empty).
- The current agent + session are always visible in the footer as `agent/session`.

## Sending + delivery

- Messages are sent to the Gateway; delivery to providers is off by default.
- Turn delivery on:
  - open the Settings panel
  - or start a Gateway-backed session with `kova tui --deliver`

## Pickers + overlays

- Model picker: list available models and set the session override.
- Agent picker: choose a different agent.
- Session picker: shows only sessions for the current agent; use `/sessions <query>` to open it filtered to matching session metadata, derived titles, or latest previews.
- Settings: toggle deliver, tool output expansion, and thinking visibility.

## Keyboard shortcuts

- Enter: send message
- Esc: abort active run
- Ctrl+C: clear input (press twice to exit)
- Ctrl+D: exit
- Ctrl+L: model picker
- Ctrl+G: agent picker
- Ctrl+P: session picker
- Ctrl+O: toggle tool output expansion
- Ctrl+T: toggle thinking visibility (reloads history)
- Alt+Enter: queue the current input as a follow-up
- Alt+Up: restore the most recent queued follow-up to the editor

## Kova terminal controls

Run `/help` to show the compact terminal command map inside the TUI. Use
`/commands` when you want the full command catalog, or `/help all` when you
want the long help view. Help keeps local controls and the Gateway-backed
command surface in one place.

Core:

- `/help`
- `/commands`
- `/status [full|detail]`
- `/gateway-status`
- `/limits`
- `/agent <id>` (or `/agents`)
- `/session <key>` (or `/sessions [query]`)
- `/model <provider/model>` (or `/models`)
- `/tools [compact|verbose]`
- `/skills [compact|verbose]`
- `/tasks [list|running|subagents|cron|audit|repair [apply]]`
- `/automation [list|running|queued|failed|audit]`
- `/subagents [list]`
- `/recover [status|apply]`
- `/rollback [list|show <id>|branch <id>|restore <id> confirm]`
- `/context [list|detail|json]`
- `/memory [status|help|sync [force]|search <query>|read <path[:line[-end]]>|dreams]`
- `/skill <name> [args]`
- `/plugins [list|verbose|show <plugin>]`
- `/permissions [edit|preset <locked|reviewed|balanced|trusted|default>]`
- `/approve [id] [allow-once|allow-always|deny]`

Capability map:

- channels: `kova channels capabilities`
- plugins and plugin-owned tools: `/plugins list|verbose|show` or `kova plugins inspect --all`
- MCP saved server config: `kova mcp status`
- model/provider readiness: `/models` or `kova models status`
- context vs provider quota: `/limits` or `kova status --usage`
- runtime isolation: `kova sandbox list`

Session controls:

- `/think <default|off|minimal|low|medium|high>`
- `/fast <status|on|off|default>`
- `/verbose <on|full|off>`
- `/trace <on|off>`
- `/reasoning <on|off|stream>`
- `/usage [off|tokens|full|cost]`
- `/elevated <on|off|ask|full>`
- `/activation <mention|always>`
- `/busy <status|queue|steer|interrupt|clear>`

Permission controls:

- `/permissions` shows the current tool, exec, sandbox, plugin, and agent override policy.
- `/permissions edit` opens the terminal permission picker.
- `/permissions preset locked|reviewed|balanced|trusted|default` changes current-session exec defaults. These are session overrides; use `kova exec-policy preset cautious|yolo|deny-all` when you want durable local config.
- `/approve` resolves pending exec/tool approval prompts.

Busy input defaults to `queue` in the terminal so accidental follow-ups do not
interrupt an active local run. Use `/busy interrupt` when you explicitly want a
new message to replace the current run. Use `/busy steer` when you want new
messages injected into the active embedded run at the next safe tool boundary;
if steering is not available yet, the TUI queues the message as a follow-up.

`/subagents` shows active subagent work and recent terminal summaries without
starting an agent turn. Subagent completion is push-based, so use this view for
on-demand inspection only; wait for the parent summary instead of polling it in
a loop.

`/recover` runs the terminal self-healing loop. It audits background tasks and
Task Flow state, previews safe maintenance, and shows one compact repair plan.
Use `/recover apply` to reconcile lost or stale task records, recover durable
cron completions, stamp missing cleanup metadata, and prune expired terminal
records. The same command works in local embedded mode and through the Gateway.

`/rollback` exposes session compaction checkpoints in the TUI. `/rollback`
lists checkpoints for the current session, `/rollback show <id>` previews one,
`/rollback branch <id>` opens the pre-compaction snapshot as a separate session,
and `/rollback restore <id> confirm` replaces the current session after an
explicit confirm step. Restore is blocked while a run is active.

This is session rollback, not filesystem restore. File-mutation checkpoints are
tracked separately in [Filesystem Checkpoint And Rollback](/plan/filesystem-checkpoint-rollback).

`/memory dreams` reads the latest Dream Diary entries from `DREAMS.md` or
`dreams.md` directly in the terminal. Use `/memory dreams all` for the full file
or `/memory dreams lines=40` for a smaller tail.

Session lifecycle:

- `/new` starts a fresh session
- `/reset` clears the current session
- `/stop` (stop the active run)
- `/settings`
- `/exit`

Short aliases such as `/gwstatus`, `/elev`, `/abort`, and `/quit` still work,
but the TUI command palette shows canonical commands only.
Hermes-style aliases also work when Kova has an equivalent: `/background`,
`/bg`, and `/side` route to `/btw`; `/q` routes to `/queue`; `/provider`
routes to `/model`; `/footer` routes to `/usage`.

Local mode only:

- `/auth [provider]` opens the provider auth/login flow inside the TUI.

Other Gateway slash commands are forwarded to the Gateway and shown as system
output. See [Slash commands](/tools/slash-commands).

Bare `/status` is a fast local terminal snapshot so it stays responsive even
when history, tools, or provider checks are slow. Use `/status full` or
`/status detail` when you want the richer shared status block with model,
runtime, session, and usage details.

Bare `/usage` shows the current terminal usage snapshot without changing
settings. Use `/usage tokens`, `/usage full`, or `/usage off` to change the
per-response footer mode, and `/usage cost` for the local cost summary when
available.

## Local shell commands

- Prefix a line with `!` to run a local shell command on the TUI host.
- The TUI prompts once per session to allow local execution; declining keeps `!` disabled for the session.
- Commands run in a fresh, non-interactive shell in the TUI working directory (no persistent `cd`/env).
- Local shell commands receive `KOVA_SHELL=tui-local` in their environment.
- A lone `!` is sent as a normal message; leading spaces do not trigger local exec.

## Repair configs from the local TUI

Use local mode when the current config already validates and you want the
embedded agent to inspect it on the same machine, compare it against the docs,
and help repair drift without depending on a running Gateway.

If `kova config validate` is already failing, start with `kova configure`
or `kova doctor --fix` first. `kova` does not bypass the invalid-
config guard.

Typical loop:

1. Start local mode:

```bash
kova
```

2. Ask the agent what you want checked, for example:

```text
Compare my gateway auth config with the docs and suggest the smallest fix.
```

3. Use local shell commands for exact evidence and validation:

```text
!kova config file
!kova docs gateway auth token secretref
!kova config validate
!kova doctor
```

4. Apply narrow changes with `kova config set` or `kova configure`, then rerun `!kova config validate`.
5. If Doctor recommends an automatic migration or repair, review it and run `!kova doctor --fix`.

Tips:

- Prefer `kova config set` or `kova configure` over hand-editing `kova.json`.
- `kova docs "<query>"` searches the live docs index from the same machine.
- `kova config validate --json` is useful when you want structured schema and SecretRef/resolvability errors.

## Tool output

- Tool calls show as cards with args + results.
- Ctrl+O toggles between collapsed/expanded views.
- While tools run, partial updates stream into the same card.

## Terminal colors

- The TUI keeps assistant body text in your terminal's default foreground so dark and light terminals both stay readable.
- If your terminal uses a light background and auto-detection is wrong, set `KOVA_THEME=light` before launching `kova`.
- To force the original dark palette instead, set `KOVA_THEME=dark`.

## History + streaming

- On connect, the TUI loads the latest history (default 80 messages).
- Streaming responses update in place until finalized.
- The TUI also listens to agent tool events for a compact activity rail.

## Connection details

- The TUI registers with the Gateway as `mode: "tui"`.
- Reconnects show a system message; event gaps are surfaced in the log.

## Options

- `--local`: Run against the local embedded agent runtime
- `--url <url>`: Gateway WebSocket URL (defaults to config or `ws://127.0.0.1:<port>`)
- `--token <token>`: Gateway token (if required)
- `--password <password>`: Gateway password (if required)
- `--session <key>`: Session key (default: `main`, or `global` when scope is global)
- `--deliver`: Deliver assistant replies to the provider (default off)
- `--thinking <level>`: Override thinking level for sends
- `--message <text>`: Send an initial message after connecting
- `--timeout-ms <ms>`: Agent timeout in ms (defaults to `agents.defaults.timeoutSeconds`)
- `--history-limit <n>`: History entries to load (default `80`)

## Timing diagnostics

For local-mode reply latency debugging, launch with:

```bash
KOVA_TUI_TRACE=1 kova
```

The chat log prints timing markers for the local turn handoff, session load,
agent import/dependency setup, agent dispatch, first agent event, first assistant
text, finalization, and one summary naming the slowest observed segment. Use
this only while debugging; normal runs keep these markers hidden.

<Warning>
When you set `--url`, the TUI does not fall back to config or environment credentials. Pass `--token` or `--password` explicitly. Missing explicit credentials is an error. In local mode, do not pass `--url`, `--token`, or `--password`.
</Warning>

## Troubleshooting

No output after sending a message:

- Run `/status` in the TUI to confirm the Gateway is connected and idle/busy.
- Check the Gateway logs: `kova logs --follow`.
- Confirm the agent can run: `kova status` and `kova models status`.
- If you expect messages in a chat channel, enable delivery in Settings or start with `--deliver`.

## Connection troubleshooting

- `disconnected`: ensure the Gateway is running and your `--url/--token/--password` are correct.
- No agents in picker: check `kova agents list` and your routing config.
- Empty session picker: you might be in global scope or have no sessions yet.

## Related

- [Settings](/cli/settings) — terminal settings console
- [Config](/cli/config) — inspect, validate, and edit `kova.json`
- [Doctor](/cli/doctor) — guided repair and migration checks
- [CLI Reference](/cli) — full CLI command reference
