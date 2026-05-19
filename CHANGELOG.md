# Changelog

## Unreleased

### Changes

- Gateway startup now overlaps logging, connector warmup, plugin services, and channel startup so the dashboard becomes ready sooner. Thanks @samzong
- Simplify the Control UI Agents section with quieter copy, plain agent rows, a compact overview, and less decorative workspace/file editing chrome. Thanks @chiragborse1
- Add a dedicated Control UI Persona menu with simple Identity, Behavior, and About You sections, default file creation, bootstrap status, and local draft recovery after refresh. Thanks @chiragborse1

### Fixes

- Installer/Windows: keep the git-install `kova.cmd` wrapper after writing it, instead of deleting the command shim before PATH setup can use it. Thanks @chiragborse1
- Codex app-server: include writable Docker bind host roots in the native turn sandbox policy so Codex-side shell/file actions follow Kova sandbox write access. Thanks @joshavant
- Agents: honor explicit `models.providers.<id>.timeoutSeconds` values above the default idle watchdog for cloud and self-hosted providers, so long first-token waits no longer fall back at ~120s when the provider timeout is higher. Thanks @yujiawei
- Codex app-server: preserve plugin-tool auth profiles while keeping Codex transport auth scoped, so plugin-owned tools can still see their provider credentials. Thanks @rubencu
- Agents/subagents: skip wake probes for dormant completion requesters so late subagent completions stay on the requester-agent/direct handoff path. Thanks @galiniliev
- Agents: preserve reply-target context for bare Telegram and grouped-channel turns so quoted-message replies still reach the model when the visible body is only a mention. Thanks @joshavant
- Agents: refresh final delivery routing from disk before sending a completed turn, while guarding against cross-session refreshes. Thanks @joshavant
- Config: allow bundled model provider timeout overlays without requiring users to redeclare provider base URLs and model lists, while keeping custom providers strict. Thanks @giodl73
- Telegram: recover isolated polling spool lanes by claiming active updates, tombstoning timed-out handlers, and aborting stuck reply work so later updates can drain. Thanks @joshavant
- Telegram: keep forum-topic routing and buffered media/text lanes scoped per topic so sibling topics can progress independently. Thanks @VACInc
- CLI: format `kova acp client` failures through the shared error formatter so object-shaped errors stay readable instead of printing `[object Object]`. Thanks @hclsys
- Agents: make trajectory flush and general cleanup timeout limits configurable with `KOVA_TRAJECTORY_FLUSH_TIMEOUT_MS` and `KOVA_AGENT_CLEANUP_TIMEOUT_MS`. Thanks @bunsthedev
- Agents: include queued-writer diagnostics in trajectory flush timeout warnings so stuck cleanup logs show pending writes, queued bytes, and active append state. Thanks @galiniliev
- Agents: treat repeated embedded-run clears as idempotent so late cleanup does not log false handle mismatch diagnostics after a run already completed. Thanks @galiniliev
- CLI/TUI: include gateway plugin slash commands in TUI autocomplete so connected sessions can suggest plugin-owned commands from the running gateway. Thanks @se7en-agent
- CLI: retry config snapshot reads after a transient failure so one rejected read no longer poisons later commands in the same process. Thanks @honor2030
