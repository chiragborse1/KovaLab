---
summary: "CLI reference for `kova persona` (status/show/path/init/edit SOUL.md)"
read_when:
  - Editing the agent persona from the terminal
  - Replacing Gateway clients persona editing with CLI/TUI workflows
title: "Persona"
---

# `kova persona`

Inspect and edit the active agent's `SOUL.md` from the terminal.

`SOUL.md` is the persona, tone, and boundary file loaded into every session.
Visible name, emoji, and avatar still live in `IDENTITY.md`; edit those with
[`kova agents set-identity`](/cli/agents#set-identity).

## Examples

```bash
kova persona
kova persona status
kova persona show
kova persona show --lines 80
kova persona show --all
kova persona path
kova persona init
kova persona edit
kova persona edit --editor "code --wait"
```

## Chat shortcut

Authorized chat surfaces can inspect persona state without opening the browser:

- `/persona status`: show the selected agent's `SOUL.md` status and terminal edit command.
- `/persona show [lines=<count>|all]`: read `SOUL.md` from chat.
- `/persona path`: show the active `SOUL.md` path.

Chat commands do not write persona files. Use `kova persona edit` or
`kova persona init` from the terminal for writes.

## Options

All subcommands accept:

- `--agent <id>`: target an agent by id. Defaults to the current default agent.
- `--workspace <dir>`: target a workspace directly.
- `--json`: print script-friendly JSON.

`persona show`:

- `--lines <n>`: show the first N lines, capped to a safe terminal limit.
- `--all`: show the full file.

`persona init`:

- Creates `SOUL.md` from the default template if it is missing.
- `--force`: reset `SOUL.md` from the default template after writing a backup beside it.

`persona edit`:

- Creates `SOUL.md` if it is missing.
- Opens `$VISUAL` or `$EDITOR`.
- `--editor <cmd>` overrides the editor command.
- `--print-path` prints the path without opening an editor.

## Related

- [Agent workspace](/concepts/agent-workspace)
- [SOUL.md personality guide](/concepts/soul)
- [Agents](/cli/agents)
