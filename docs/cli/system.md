---
summary: "CLI reference for `kova system` (system events, Pulse, presence)"
read_when:
  - You want to enqueue a system event without creating a cron job
  - You need to enable or disable Pulse
  - You want to inspect system presence entries
title: "System"
---

# `kova system`

System-level helpers for the Gateway: enqueue system events, control Pulse,
and view presence.

All `system` subcommands use Gateway RPC and accept the shared client flags:

- `--url <url>`
- `--token <token>`
- `--timeout <ms>`
- `--expect-final`

## Common commands

```bash
kova system event --text "Check for urgent follow-ups" --mode now
kova system event --text "Check for urgent follow-ups" --url ws://127.0.0.1:18789 --token "$KOVA_GATEWAY_TOKEN"
kova system pulse enable
kova system pulse last
kova system presence
```

## `system event`

Enqueue a system event on the **main** session. The next Pulse run will inject
it as a `System:` line in the prompt. Use `--mode now` to trigger Pulse
immediately; `next-pulse` waits for the next scheduled tick.

Flags:

- `--text <text>`: required system event text.
- `--mode <mode>`: `now` or `next-pulse` (default).
- `--json`: machine-readable output.
- `--url`, `--token`, `--timeout`, `--expect-final`: shared Gateway RPC flags.

## `system pulse last|enable|disable`

Pulse controls:

- `last`: show the last Pulse event.
- `enable`: turn Pulse back on (use this if it was disabled).
- `disable`: pause Pulse.

Flags:

- `--json`: machine-readable output.
- `--url`, `--token`, `--timeout`, `--expect-final`: shared Gateway RPC flags.

## `system presence`

List the current system presence entries the Gateway knows about (nodes,
instances, and similar status lines).

Flags:

- `--json`: machine-readable output.
- `--url`, `--token`, `--timeout`, `--expect-final`: shared Gateway RPC flags.

## Notes

- Requires a running Gateway reachable by your current config (local or remote).
- System events are ephemeral and not persisted across restarts.

## Related

- [CLI reference](/cli)
