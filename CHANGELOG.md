# Changelog

## Unreleased

### Changes

- Gateway startup now overlaps logging, connector warmup, plugin services, and channel startup so the dashboard becomes ready sooner. Thanks @samzong
- Simplify the Control UI Agents section with quieter copy, plain agent rows, a compact overview, and less decorative workspace/file editing chrome. Thanks @chiragborse1
- Add a dedicated Control UI Persona menu with simple Identity, Behavior, and About You sections, default file creation, bootstrap status, and local draft recovery after refresh. Thanks @chiragborse1

### Fixes

- Config: allow bundled model provider timeout overlays without requiring users to redeclare provider base URLs and model lists, while keeping custom providers strict. Thanks @giodl73
- Telegram: recover isolated polling spool lanes by claiming active updates, tombstoning timed-out handlers, and aborting stuck reply work so later updates can drain. Thanks @joshavant
- Telegram: keep forum-topic routing and buffered media/text lanes scoped per topic so sibling topics can progress independently. Thanks @VACInc
- CLI: format `kova acp client` failures through the shared error formatter so object-shaped errors stay readable instead of printing `[object Object]`. Thanks @hclsys
- Agents: make trajectory flush and general cleanup timeout limits configurable with `KOVA_TRAJECTORY_FLUSH_TIMEOUT_MS` and `KOVA_AGENT_CLEANUP_TIMEOUT_MS`. Thanks @bunsthedev
- Agents: include queued-writer diagnostics in trajectory flush timeout warnings so stuck cleanup logs show pending writes, queued bytes, and active append state. Thanks @galiniliev
- Agents: treat repeated embedded-run clears as idempotent so late cleanup does not log false handle mismatch diagnostics after a run already completed. Thanks @galiniliev
- CLI/TUI: include gateway plugin slash commands in TUI autocomplete so connected sessions can suggest plugin-owned commands from the running gateway. Thanks @se7en-agent
