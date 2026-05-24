---
summary: "Agent runtime, workspace contract, and session bootstrap"
read_when:
  - Changing agent runtime, workspace bootstrap, or session behavior
title: "Agent runtime"
---

Kova's default product shape is **one personal agent controlled by the local
Gateway**. That default agent has a workspace, bootstrap files, model/auth
configuration, and a session store. This page covers the default runtime
contract: what the workspace must contain, which files get injected, and how
sessions bootstrap against it.

The same Gateway can also host multiple isolated agents. Treat that as an
advanced routing layer on top of the default model, not a separate product
concept. The default path is one agent; [Multi-agent routing](/concepts/multi-agent)
explains how extra isolated agents extend it.

## Product spine

The agent layer has one job: run useful turns inside an explicit workspace.

- **Gateway** owns control, routing, auth, transport, and observability.
- **Agent runtime** owns model turns, tools, session history, and workspace
  bootstrap.
- **Workspace files** own persona, instructions, local notes, and user-editable
  memory.
- **Plugins** add providers, channels, tools, skills, and harnesses without
  making core depend on plugin-specific implementation details.
- **Automation** triggers or tracks agent work; it does not replace the agent
  runtime.

When adding or debugging a feature, decide which layer owns the behavior before
changing code.

## Workspace (required)

Kova uses one workspace directory for the default agent
(`agents.defaults.workspace`) as that agent's working directory (`cwd`) for
tools and context.

Recommended: use `kova setup` to create `~/.kova/kova.json` if missing and initialize the workspace files.

Full workspace layout + backup guide: [Agent workspace](/concepts/agent-workspace)

If `agents.defaults.sandbox` is enabled, non-main sessions can override this with
per-session workspaces under `agents.defaults.sandbox.workspaceRoot` (see
[Gateway configuration](/gateway/configuration)).

## Bootstrap files (injected)

Inside `agents.defaults.workspace`, Kova expects these user-editable files:

- `AGENTS.md` — operating instructions + “memory”
- `SOUL.md` — persona, boundaries, tone
- `TOOLS.md` — user-maintained tool notes (e.g. `imsg`, `sag`, conventions)
- `BOOTSTRAP.md` — one-time first-run ritual (deleted after completion)
- `IDENTITY.md` — agent name/vibe/emoji
- `USER.md` — user profile + preferred address

On the first turn of a new session, Kova injects the contents of these files directly into the agent context.

Blank files are skipped. Large files are trimmed and truncated with a marker so prompts stay lean (read the file for full content).

If a file is missing, Kova injects a single “missing file” marker line (and `kova setup` will create a safe default template).

`BOOTSTRAP.md` is only created for a **brand new workspace** (no other bootstrap files present). If you delete it after completing the ritual, it should not be recreated on later restarts.

To disable bootstrap file creation entirely (for pre-seeded workspaces), set:

```json5
{ agents: { defaults: { skipBootstrap: true } } }
```

## Built-in tools

Core tools (read/exec/edit/write and related system tools) are always available,
subject to tool policy. `apply_patch` is optional and gated by
`tools.exec.applyPatch`. `TOOLS.md` does **not** control which tools exist; it’s
guidance for how _you_ want them used.

## Skills

Kova loads skills from these locations (highest precedence first):

- Workspace: `<workspace>/skills`
- Project agent skills: `<workspace>/.agents/skills`
- Personal agent skills: `~/.agents/skills`
- Managed/local: `~/.kova/skills`
- Bundled (shipped with the install)
- Extra skill folders: `skills.load.extraDirs`

Skills can be gated by config/env (see `skills` in [Gateway configuration](/gateway/configuration)).

## Runtime boundaries

The embedded agent runtime is built on the Pi agent core (models, tools, and
prompt pipeline). Session management, discovery, tool wiring, and channel
delivery are Kova-owned layers on top of that core.

## Sessions

Session transcripts are stored as JSONL at:

- `~/.kova/agents/<agentId>/sessions/<SessionId>.jsonl`

The session ID is stable and chosen by Kova.
Legacy session folders from other tools are not read.

## Steering while streaming

When queue mode is `steer`, inbound messages are injected into the current run.
Queued steering is delivered **after the current assistant turn finishes
executing its tool calls**, before the next LLM call. Steering no longer skips
remaining tool calls from the current assistant message; it injects the queued
message at the next model boundary instead.

When queue mode is `followup` or `collect`, inbound messages are held until the
current turn ends, then a new agent turn starts with the queued payloads. See
[Queue](/concepts/queue) for mode + debounce/cap behavior.

Block streaming sends completed assistant blocks as soon as they finish; it is
**off by default** (`agents.defaults.blockStreamingDefault: "off"`).
Tune the boundary via `agents.defaults.blockStreamingBreak` (`text_end` vs `message_end`; defaults to text_end).
Control soft block chunking with `agents.defaults.blockStreamingChunk` (defaults to
800–1200 chars; prefers paragraph breaks, then newlines; sentences last).
Coalesce streamed chunks with `agents.defaults.blockStreamingCoalesce` to reduce
single-line spam (idle-based merging before send). Non-Telegram channels require
explicit `*.blockStreaming: true` to enable block replies.
Verbose tool summaries are emitted at tool start (no debounce); Control UI
streams tool output via agent events when available.
More details: [Streaming + chunking](/concepts/streaming).

## Model refs

Model refs in config (for example `agents.defaults.model` and `agents.defaults.models`) are parsed by splitting on the **first** `/`.

- Use `provider/model` when configuring models.
- If the model ID itself contains `/` (OpenRouter-style), include the provider prefix (example: `openrouter/moonshotai/kimi-k2`).
- If you omit the provider, Kova tries an alias first, then a unique
  configured-provider match for that exact model id, and only then falls back
  to the configured default provider. If that provider no longer exposes the
  configured default model, Kova falls back to the first configured
  provider/model instead of surfacing a stale removed-provider default.

## Configuration (minimal)

At minimum, set:

- `agents.defaults.workspace`
- `channels.whatsapp.allowFrom` (strongly recommended)

---

_Next: [Group Chats](/channels/group-messages)_ 🦄

## Related

- [Agent workspace](/concepts/agent-workspace)
- [Multi-agent routing](/concepts/multi-agent)
- [Session management](/concepts/session)
