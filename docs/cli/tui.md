---
summary: "CLI reference for `kova tui` and `kova chat`"
read_when:
  - You want a terminal UI for the Gateway (remote-friendly)
  - You want to pass url/token/session from scripts
  - You want to run the TUI in local embedded mode without a Gateway
  - You want to use kova chat or kova tui --local
title: "TUI"
---

# `kova tui`

Open Kova's terminal UI. `kova chat` is the default local embedded path; `kova
tui` can also connect to a running Gateway for remote or always-on sessions.

Related:

- TUI guide: [TUI](/web/tui)

Notes:

- `chat` and `terminal` are aliases for `kova tui --local`.
- Local mode is the fastest first chat path and does not require the Gateway or Control UI.
- `--local` cannot be combined with `--url`, `--token`, or `--password`.
- `tui` resolves configured gateway auth SecretRefs for token/password auth when possible (`env`/`file`/`exec` providers).
- When launched from inside a configured agent workspace directory, TUI auto-selects that agent for the session key default (unless `--session` is explicitly `agent:<id>:...`).
- Local mode uses an isolated local backend worker for the embedded agent runtime. Most local tools work, but Gateway-only features are unavailable.
- Local mode adds `/auth [provider]` inside the TUI command surface.
- Plugin approval gates still apply in local mode. Tools that require approval prompt for a decision in the terminal; nothing is silently auto-approved because the Gateway is not involved.
- `/help` opens the terminal command center with core navigation, run controls, Gateway status, tools, context, memory, skills, and plugin commands.

## Examples

```bash
kova chat
kova tui --local
kova chat --history-limit 30
kova tui
kova tui --url ws://127.0.0.1:18789 --token <token>
kova tui --session main --deliver
kova chat --message "Compare my config to the docs and tell me what to fix"
# when run inside an agent workspace, infers that agent automatically
kova tui --session bugfix
```

## Config repair loop

Use local mode when the current config already validates and you want the local
agent worker to inspect it, compare it against the docs, and help repair it from
the same terminal:

If `kova config validate` is already failing, use `kova configure` or
`kova doctor --fix` first. `kova chat` does not bypass the invalid-
config guard.

```bash
kova chat
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
