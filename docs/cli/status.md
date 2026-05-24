---
summary: "CLI reference for `kova status` (terminal readiness, diagnostics, probes, usage snapshots)"
read_when:
  - You want a quick terminal readiness check with Gateway, memory, skills, channels, and recent sessions
  - You want a pasteable “all” status for debugging
title: "Status"
---

# `kova status`

Terminal command-center snapshot for local chat readiness, Gateway health,
memory, plugin compatibility, channels, tasks, and recent sessions.

```bash
kova status
kova status --all
kova status --deep
kova status --usage
```

Notes:

- The Overview starts with `Terminal: kova chat`. Use `kova settings`,
  `kova logs`, `kova tasks`, `kova memory`, `kova skills`, and TUI slash
  commands for daily administration. The browser UI appears only when it is
  explicitly enabled.
- `--deep` runs live probes (WhatsApp Web + Telegram + Discord + Slack + Signal).
- The Memory row is intentionally lightweight: plain `status` does not run a live vector/embedding probe. Use `kova memory status --deep` for memory backend diagnostics and `kova memory index` for an on-demand sync.
- `--usage` prints normalized provider usage windows as `X% left`.
- Session status output separates `Execution:` from `Runtime:`. `Execution` is the sandbox path (`direct`, `docker/*`), while `Runtime` tells you whether the session is using `Kova Pi Default`, `OpenAI Codex`, a CLI backend, or an ACP backend such as `codex (acp/acpx)`. See [Agent runtimes](/concepts/agent-runtimes) for the provider/model/runtime distinction.
- MiniMax's raw `usage_percent` / `usagePercent` fields are remaining quota, so Kova inverts them before display; count-based fields win when present. `model_remains` responses prefer the chat-model entry, derive the window label from timestamps when needed, and include the model name in the plan label.
- When the current session snapshot is sparse, `/status` can backfill token and cache counters from the most recent transcript usage log. Existing nonzero live values still win over transcript fallback values.
- Transcript fallback can also recover the active runtime model label when the live session entry is missing it. If that transcript model differs from the selected model, status resolves the context window against the recovered runtime model instead of the selected one.
- For prompt-size accounting, transcript fallback prefers the larger prompt-oriented total when session metadata is missing or smaller, so custom-provider sessions do not collapse to `0` token displays.
- Output includes per-agent session stores when multiple agents are configured.
- Overview includes Gateway + node host service install/runtime status when available.
- Overview includes update channel + git SHA (for source checkouts).
- Update info surfaces in the Overview; if an update is available, status prints a hint to run `kova update` (see [Updating](/install/updating)).
- Read-only status surfaces (`status`, `status --json`, `status --all`) resolve supported SecretRefs for their targeted config paths when possible.
- If a supported channel SecretRef is configured but unavailable in the current command path, status stays read-only and reports degraded output instead of crashing. Human output shows warnings such as “configured token unavailable in this command path”, and JSON output includes `secretDiagnostics`.
- When command-local SecretRef resolution succeeds, status prefers the resolved snapshot and clears transient “secret unavailable” channel markers from the final output.
- `status --all` includes a Secrets overview row and a diagnosis section that summarizes secret diagnostics (truncated for readability) without stopping report generation.

## Related

- [CLI reference](/cli)
- [Doctor](/gateway/doctor)
