---
summary: "Terminal parity checklist for retiring the browser Gateway clients"
read_when:
  - You are moving a Gateway clients workflow into the CLI or TUI
  - You want to know whether a browser-only workflow still blocks terminal-first Kova
title: "Terminal Control Parity"
---

# Terminal Control Parity

Kova is moving toward a terminal-first control surface. The browser Gateway clients
should stay available as an optional legacy surface until the important
operator workflows below have terminal equivalents with tests and docs.

Do not delete a browser workflow only because it is unpopular. Delete it after
the matching terminal workflow is easier to find, covers the same operator
need, and has a small proof command or test.

## Current Matrix

| Gateway clients workflow       | Terminal equivalent                                                                           | Status  | Next action                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| Chat with the agent            | `kova`                                                                                        | Ready   | Keep first-run latency and local backend checks in the TUI test loop.          |
| Gateway status                 | `kova status`, `/status`, `/gateway-status`                                                   | Ready   | Keep browser wording out of default status output.                             |
| Model selection                | `/model`, `/models`, `kova models list`, `kova models set`                                    | Ready   | Keep provider auth guidance terminal-readable.                                 |
| Sessions                       | `/session`, `/sessions <query>`, `kova sessions --search <query>`                             | Ready   | Keep session search fast before loading large histories.                       |
| Tools catalog                  | `/tools [compact\|verbose]`                                                                   | Ready   | Keep compact mode useful on small terminals.                                   |
| Tool permissions               | `kova permissions`, `/permissions`, `/permissions edit`, `kova exec-policy`, `kova approvals` | Ready   | TUI handles session posture; durable config still routes through focused CLIs. |
| Skills catalog                 | `/skills [compact\|verbose]`                                                                  | Ready   | Keep skill health summaries terminal-readable.                                 |
| Task and automation status     | `/tasks`, `/automation`, `/subagents`                                                         | Ready   | Keep background completion push-based, not polling-heavy.                      |
| Recovery and repair            | `/recover`, `/recover apply`, `kova doctor`                                                   | Ready   | Keep repair previews explicit before mutation.                                 |
| Memory status and recall       | `/memory status`, `/memory search`, `/memory read`, `kova memory ...`                         | Ready   | Keep degraded vector or keyword-only state clear.                              |
| Dream Diary review             | `kova memory dreams`, `/memory dreams`                                                        | Ready   | Keep bounded terminal output and JSON for scripts.                             |
| Dreaming toggle                | `/dreaming on\|off\|status`                                                                   | Ready   | Add CLI config examples only when users ask for non-chat automation.           |
| Persona editing                | `kova persona ...` plus `/persona` read-only chat inspection                                  | Ready   | Keep `SOUL.md` as the file-backed source of truth.                             |
| Plugin management              | `kova plugins ...`, `/plugins install\|update\|enable\|disable`                               | Ready   | Keep plugin mutation replies concise and restart-aware.                        |
| Channel setup                  | `kova channels ...`, `kova configure --section channels`                                      | Ready   | Keep quick onboarding channel-free unless `--with-channels` is selected.       |
| Logs                           | `kova logs --grep/--level/--subsystem`, Gateway log path from status                          | Ready   | Keep filters cheap and readable for remote tailing.                            |
| Config editing                 | `kova settings`, `kova configure --section ...`, `kova config get/set`                        | Ready   | Keep common toggles in `kova settings` before adding raw config paths.         |
| Cron and schedules             | `kova cron templates`, `kova cron add --template ...`, `/tasks cron`                          | Ready   | Keep templates aligned with common reminder and automation workflows.          |
| Voice and realtime controls    | `/tts`, `kova infer tts ...`, `kova voicecall ...` when installed                             | Ready   | Keep realtime carrier/provider controls plugin-owned and documented.           |
| Node pairing and device access | `kova qr`, `kova devices ...`, `kova nodes ...`, `kova pairing ...`                           | Ready   | Keep approval previews explicit before minting or rotating tokens.             |
| Canvas and visual previews     | Node canvas/image file output plus browser preview links                                      | Retired | Do not treat visual previews as a blocker for terminal-first control.          |

## Deletion Rule

Before removing a browser-only page or panel:

1. Add or identify the terminal command that covers the same workflow.
2. Update the CLI/TUI docs and command help.
3. Add a targeted test for parsing, output, or command routing.
4. Verify the workflow without running the full local heavy gate when the host
   cannot support it.
5. Remove the browser code only after the matrix row is `Ready` or explicitly
   marked `Retired`.

## Hermes-Style TUI MVP

Kova's MVP target is the useful terminal behavior, not a byte-for-byte clone.

Ready:

- Open user and assistant message boxes with Kova styling.
- Compact tool activity rail.
- `/verbose` cycles tool visibility; `/details` keeps explicit hidden,
  collapsed, and expanded modes.
- `/busy`, queued input, permissions, tools, skills, tasks, memory, persona,
  and plugin inspection are terminal-first.
- Slow-turn status is honest about the phase before a tool starts: tool line
  durations measure tool runtime only, while model/provider waiting remains in
  the status line and `KOVA_TUI_TRACE=1` gives the full timing proof.

Not copied into the MVP:

- Hermes skin packs and full Ink/React renderer architecture.
- Hermes-only kanban surfaces.
- Hermes-specific names, icons, and release language.
- Byte-for-byte transcript formatting where Kova already has product-owned
  terminal commands or safety behavior.

## References

- [TUI](/web/tui)
- [Memory CLI](/cli/memory)
- [Persona CLI](/cli/persona)
- [Gateway clients](/gateway/remote)
