---
summary: "Terminal parity checklist for retiring the browser Control UI"
read_when:
  - You are moving a Control UI workflow into the CLI or TUI
  - You want to know whether a browser-only workflow still blocks terminal-first Kova
title: "Terminal Control Parity"
---

# Terminal Control Parity

Kova is moving toward a terminal-first control surface. The browser Control UI
should stay available as an optional legacy surface until the important
operator workflows below have terminal equivalents with tests and docs.

Do not delete a browser workflow only because it is unpopular. Delete it after
the matching terminal workflow is easier to find, covers the same operator
need, and has a small proof command or test.

## Current Matrix

| Control UI workflow            | Terminal equivalent                                                   | Status      | Next action                                                                    |
| ------------------------------ | --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| Chat with the agent            | `kova chat`, `kova tui --local`, `kova tui`                           | Ready       | Keep first-run latency and local backend checks in the TUI test loop.          |
| Gateway status                 | `kova status`, `/status`, `/gateway-status`                           | Ready       | Keep browser wording out of default status output.                             |
| Model selection                | `/model`, `/models`, `kova models list`, `kova models set`            | Ready       | Keep provider auth guidance terminal-readable.                                 |
| Sessions                       | `/session`, `/sessions <query>`, `kova sessions --search <query>`     | Ready       | Keep session search fast before loading large histories.                       |
| Tools catalog                  | `/tools [compact\|verbose]`                                           | Ready       | Keep compact mode useful on small terminals.                                   |
| Skills catalog                 | `/skills [compact\|verbose]`                                          | Ready       | Keep skill health summaries terminal-readable.                                 |
| Task and automation status     | `/tasks`, `/automation`, `/subagents`                                 | Ready       | Keep background completion push-based, not polling-heavy.                      |
| Recovery and repair            | `/recover`, `/recover apply`, `kova doctor`                           | Ready       | Keep repair previews explicit before mutation.                                 |
| Memory status and recall       | `/memory status`, `/memory search`, `/memory read`, `kova memory ...` | Ready       | Keep degraded vector or keyword-only state clear.                              |
| Dream Diary review             | `kova memory dreams`, `/memory dreams`                                | In progress | Keep bounded terminal output and JSON for scripts.                             |
| Dreaming toggle                | `/dreaming on\|off\|status`                                           | Ready       | Add CLI config examples only when users ask for non-chat automation.           |
| Persona editing                | `kova persona ...` and file-backed workspace prompts                  | Partial     | Finish CLI/TUI editing before removing browser persona forms.                  |
| Plugin management              | `kova plugins ...`, `/plugins list`                                   | Partial     | Add terminal install/update flows before removing browser plugin affordances.  |
| Channel setup                  | `kova channels ...`, `kova configure --section channels`              | Partial     | Keep onboarding channel selection terminal-first and skip channels by default. |
| Logs                           | `kova logs ...`, Gateway log path from `kova status`                  | Partial     | Add a compact tail/filter command before removing browser log panes.           |
| Config editing                 | `kova config ...`, `kova settings`, `kova configure`                  | Partial     | Avoid raw JSON editing for common toggles.                                     |
| Cron and schedules             | `kova cron ...`, `/tasks cron`, `/automation`                         | Partial     | Add schedule creation templates before removing browser cron shortcuts.        |
| Voice and realtime controls    | CLI config plus channel/plugin commands                               | Not ready   | Keep browser surface or document a terminal replacement first.                 |
| Node pairing and device access | `kova gateway pair`, `kova nodes ...`                                 | Partial     | Keep token/pairing workflows easy from terminal.                               |
| Canvas and visual previews     | File output and browser preview links                                 | Not ready   | Treat as optional visual surface, not a core control dependency.               |

## Deletion Rule

Before removing a browser-only page or panel:

1. Add or identify the terminal command that covers the same workflow.
2. Update the CLI/TUI docs and command help.
3. Add a targeted test for parsing, output, or command routing.
4. Verify the workflow without running the full local heavy gate when the host
   cannot support it.
5. Remove the browser code only after the matrix row is `Ready` or explicitly
   marked `Retired`.

## References

- [TUI](/web/tui)
- [Memory CLI](/cli/memory)
- [Control UI](/web/control-ui)
