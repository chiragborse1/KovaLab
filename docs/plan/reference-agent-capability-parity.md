---
title: "Reference Agent Capability Parity Review"
summary: "Current capability comparison between Kova and an external reference agent platform"
read_when:
  - You are comparing Kova with another agent platform
  - You are deciding which Kova gaps are real capability gaps versus presentation or cleanup gaps
  - You are prioritizing product-spine cleanup after a broad repo review
---

## Review Scope

This review was refreshed on 2026-05-25 against current external reference
agent platforms: one messaging/app-oriented platform and one terminal/research
agent platform. Reference names and links are intentionally not stored in this
Kova-facing plan. The goal is to keep the useful capability lessons without
putting another product's branding into Kova docs.

Parity does not mean Kova should copy another project. The useful question is:

> Does Kova give the user the same kind of power, with Kova's local-first
> Gateway, plugin, workspace, and control-plane architecture kept intact?

## Latest Reference Refresh

The 2026-05-25 refresh found no reason to copy another architecture wholesale.
The remaining gaps are product decisions and packaging work, not a missing
agent core.

What still needs deliberate Kova decisions:

- Managed provider/tool gateway: Kova is still bring-your-own-key/local-first by
  default. A managed shortcut would be a product and billing decision, not a
  parity patch.
- Marketplace: KovaHub is intentionally future work. Current installs should use
  local paths, archives, npm packages, and bundled/default skills.
- Additional bundled skills: reference platforms ship more ready-made skills.
  Kova should add skills only when they are maintained, documented, tested, and
  useful in the terminal flow.
- Extra channel and utility plugins: several reference plugins are useful but
  not terminal-first launch blockers. Add them through plugin ownership, not by
  placing provider or channel behavior in core.
- Filesystem checkpoints: Kova still needs a product choice between automatic
  mutation snapshots and explicit git/workspace discipline.
- Cloud sandbox backends: Kova has local, node, Docker, SSH, OpenShell, and
  elevated execution. Serverless/cloud backends should be added only with a
  clear security and cost model.
- Skill learning loop: Kova has skills, memory, dreaming, Skill Workshop, and
  reviews. The next improvement is making the loop simple and inspectable by
  default, not adding more hidden automation.

Public release blockers from this refresh:

- Contribution and security policy must be Kova-owned and not inherited from a
  reference project.
- User-facing credits, security links, and app About surfaces must point to Kova
  owners and Kova contact paths.
- Docs should say "plugins" publicly and keep `extensions/` as the internal
  implementation term.

## Executive Finding

Kova is not behind in raw feature surface. Kova already has a large capability
set: many messaging channels, a Gateway control plane, plugin capabilities,
memory backends, media tools, sub-agents, scheduling, MCP bridge support,
OpenAI-compatible HTTP endpoints, ACP routes, sandboxing, and security audit
surfaces.

The gap is product coherence:

- The reference platform presents one clear promise: a self-improving agent that
  learns from memory, skills, session recall, gateway channels, tools, and
  automation.
- Kova has many of the same pieces, and sometimes wider pieces, but the pieces
  are scattered across overlapping concepts and old browser-first surfaces.
- Kova's next phase should focus on making its existing power feel deliberate,
  default, and inspectable before adding another large subsystem.

## Parity Matrix

| Area                       | Reference shape                                                                                                                       | Kova shape now                                                                                                                              | Status                                      | Next action                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Product frame              | One self-improving agent with CLI, Gateway, memory, skills, tools, and channels                                                       | One terminal-first personal agent, with the Gateway and multi-agent routing as advanced layers                                              | Partial                                     | Carry the product-spine wording from [Agent runtime](/concepts/agent) into docs home, onboarding, CLI/TUI, and setup flows             |
| Messaging Gateway          | One background Gateway runs many platforms, sessions, cron, slash commands, and platform operations                                   | Gateway runs channels, routing, pairing, cron, WebChat/Control UI compatibility, and multi-agent routing across a wide channel set          | Strong but fragmented                       | Add one channel capability matrix with text, media, files, reactions, threads, typing, streaming, voice, and operational status        |
| Tools and toolsets         | Toolsets organize file, terminal, web, memory, messaging, skills, media, and delegation tools                                         | Built-in tools, plugin tools, tool profiles, groups, allow/deny policy, and bundle MCP tools                                                | Strong                                      | Make tool profile selection visible in setup and terminal status/settings; keep plugin-owned tools behind manifest/runtime ownership   |
| Managed tool gateway       | One account can route paid web, image, TTS, and browser tools                                                                         | Kova has direct provider plugins and multiple web/media providers, but no single managed paid tool gateway story                            | Missing by design unless product chooses it | Decide whether Kova wants a managed provider shortcut, or explicitly stay bring-your-own-key/local-first                               |
| Terminal/runtime backends  | Local, container, SSH, and cloud sandbox backends                                                                                     | Gateway/node exec, Docker sandbox, SSH sandbox, OpenShell sandbox, elevated mode, approvals                                                 | Partial                                     | Add a backend comparison doc/table and decide whether cloud/serverless sandbox backends are product goals                              |
| Persistent memory          | Bounded agent/user memory, session search, external memory providers                                                                  | Markdown memory, daily notes, memory search, active memory, memory-core, QMD, Honcho, Memory Wiki, dreaming                                 | Strong but complex                          | Make the default memory loop simpler: save, search, promote, review; keep QMD/Honcho/wiki as advanced backends                         |
| Skill learning loop        | Agent-managed skills, suggestions, evaluation, improvement, bundles, external skill directories                                       | AgentSkills-compatible skills, multiple roots, per-agent allowlists, future KovaHub, and experimental Skill Workshop                        | Partial                                     | Graduate Skill Workshop into a clear pending-first flow, with visible proposals and safe approval UX                                   |
| Context files              | Project context files plus progressive subdirectory discovery and security scanning                                                   | Workspace bootstrap files, system prompt reports, context inspection, compaction, plugin context engines                                    | Partial                                     | Decide whether Kova needs first-class typed context references and progressive scoped file discovery beyond current read/context tools |
| Context references         | CLI `@file`, `@folder`, `@diff`, `@git`, and `@url` injection                                                                         | Kova exposes read, read_many, web_fetch, attachments, and context inspection, but no single public `@` reference contract is documented     | Gap                                         | Add or explicitly reject a context-reference command layer                                                                             |
| Filesystem checkpoints     | Automatic file-mutation snapshots with restore and diff                                                                               | Kova has session compaction rollback surfaces and diff/artifact tooling, but no documented default filesystem checkpoint/restore contract   | Gap                                         | Design file-mutation checkpoints or document why Kova will rely on git/workspace discipline instead                                    |
| Automation                 | Cron, subagent delegation, execute_code, hooks, batch processing                                                                      | Cron, hooks, standing orders, Task Flow, background tasks, heartbeat, subagents, code_execution                                             | Strong but fragmented                       | Keep implementing [Automation and tasks](/automation) as the one user model and map goals/background features onto it                  |
| Subagents                  | Isolated child agents, parallel batches, restricted toolsets, no parent history unless passed                                         | `sessions_spawn`, subagents, background task records, isolated/fork context, ACP runtime support, thread-bound sessions                     | Strong                                      | Tighten CLI/TUI visibility and defaults; avoid duplicate "agent", "session", and "task" explanations                                   |
| MCP client                 | Stdio and HTTP MCP servers with filtering, discovery, reload, dynamic tool refresh, sampling                                          | Saved MCP server definitions, config status, stdio/SSE/streamable HTTP, bundle MCP tools, cleanup, env safety filtering                     | Partial                                     | Add live reachability probes and consider dynamic `tools/list_changed` refresh and sampling support                                    |
| MCP server                 | Reference platform exposes channel conversations as an MCP server                                                                     | `kova mcp serve` exposes channel conversations, message history, live events, sends, attachments, and approvals                             | Strong                                      | Add react/edit tools only if they fit channel contracts; keep current bridge limits visible                                            |
| Provider routing           | Many providers, OAuth routes, fallback providers, credential pools, prompt cache                                                      | Many provider plugins, auth profile rotation, model fallbacks, usage status, custom endpoints, prompt cache docs                            | Strong                                      | Keep model setup simple; reduce duplicate provider compatibility surfaces through the plugin compatibility cleanup                     |
| API server                 | OpenAI-compatible server and API stream surfaces                                                                                      | OpenAI-compatible `/v1/*`, `/tools/invoke`, Gateway HTTP/WS, plus legacy browser surfaces                                                   | Strong                                      | Keep disabled-by-default security posture clear and surface endpoint state in terminal operator commands                               |
| ACP and editor integration | ACP editor integration                                                                                                                | ACP CLI, ACP sessions, external harness routes, Codex/Claude/Gemini/OpenCode style backends                                                 | Strong                                      | Keep ACP as an advanced runtime, not the default agent explanation                                                                     |
| Security                   | Defense-in-depth: user auth, approvals, container isolation, MCP env filtering, context scanning, session isolation, input validation | Personal trust model, pairing/allowlists, security audit, exec approvals, sandboxing, tool policy, MCP env filtering, Control UI auth       | Strong but different default posture        | Make "personal assistant, not hostile multi-tenant" explicit in setup and operator presets                                             |
| Media and web              | Voice, browser automation, vision, image generation, TTS, deliverable files                                                           | Browser, web/x search/fetch, PDF, media understanding, image/music/video generation, TTS, attachments, voice-call plugin                    | Strong                                      | Add a user-facing media capability matrix and make channel-specific delivery limits easier to see                                      |
| Browser/computer use       | Browser automation and computer-use backend                                                                                           | Browser tool/control service, node/device surfaces, Codex computer-use MCP bridge docs                                                      | Partial                                     | Decide whether native Kova computer-use belongs in core, browser plugin, or external MCP/app plugin                                    |
| Checkable learning         | Memory nudges, skill creation, session search, and self-improvement as one loop                                                       | Kova has memory flush, dreaming, Skill Workshop, skills, session history, and trajectory tools, but no single default "learning loop" story | Main gap                                    | Define the Kova learning loop as a first-class product feature before enabling more automation by default                              |
| Research/data generation   | Batch runner and trajectory data for training/eval                                                                                    | Trajectory export, QA labs, channel scenarios, workflow tooling                                                                             | Partial                                     | Keep this as advanced contributor/research tooling unless the product needs public batch runs                                          |
| UI coherence               | TUI plus docs present one integrated path                                                                                             | TUI, docs, CLI settings/status/logs, mobile/app surfaces, plus legacy browser surfaces                                                      | Main gap                                    | Make CLI/TUI the complete path before adding any new browser panels                                                                    |

## What Kova Should Adapt

Kova should adapt the clarity, not the structure:

- one front-door explanation of the agent loop
- capability matrices that show what works per channel/tool surface
- an obvious learning loop: memory, session recall, skills, review, improvement
- simple setup pickers for models, tools, memory, and channels
- file-mutation rollback as a trust-building safety feature
- clear runtime backend comparison for local, container, remote, and cloud

## What Kova Should Avoid

Kova should not flatten its architecture just to match another platform.

Do not move plugin-owned behavior into core just for parity. Kova's strongest
architecture direction is still manifest-first plugins, explicit Gateway
contracts, local-first workspaces, and owner-aware compatibility cleanup.

Avoid copying:

- provider-specific behavior into core
- channel-specific defaults into generic routing
- a managed tool gateway unless Kova intentionally wants that business/product
  model
- automatic skill or memory writes without reviewable state and safe defaults
- a broad multi-tenant security claim Kova does not intend to make

## Priority Backlog

### P0: Preserve The Kova Vision

Make the default product path impossible to miss:

- local terminal-first agent
- Gateway when the user wants always-on delivery and channels
- one personal agent by default
- plugins for providers, channels, tools, skills, harnesses, and media
- memory and skills as reviewable local files
- automation as hooks, cron, Task Flow, background tasks, heartbeat, and
  standing orders

### P1: Turn Existing Capability Into A Closed Learning Loop

Kova already has most of the parts. The product gap is the loop:

1. Capture durable facts into memory.
2. Search and recall those facts when useful.
3. Promote repeated procedures into skills.
4. Review skill proposals before they become active by default.
5. Curate stale memory and skills with visible reports.

Skill Workshop and dreaming should become easier to inspect before they become
more automatic.

### P1: Add Capability Matrices

Create user-facing matrices for:

- channels: text, media, files, reactions, threads, typing, streaming, voice
- tools: built-in, plugin-provided, MCP-provided, profile visibility
- runtimes: direct Gateway, node, Docker sandbox, SSH sandbox, OpenShell
- memory: built-in, QMD, Honcho, Memory Wiki, session transcript search

The first docs-derived inventory lives in
[Kova Capability Matrices](/plan/kova-capability-matrices).

This will make Kova feel less messy without deleting capability.

### P1: Decide Filesystem Checkpoint Strategy

Rollback is part of user trust. Kova should choose one of two paths:

- implement automatic file-mutation checkpoints with diff and restore, or
- explicitly document that Kova relies on git/workspace discipline and focused
  diff artifacts instead.

Leaving this ambiguous is worse than either choice.

### P2: Tighten MCP Runtime Parity

Kova already has important MCP surfaces. The remaining gaps are:

- live reachability probes for saved MCP servers
- dynamic tool refresh when servers announce tool-list changes
- sampling support, if a real Kova use case exists
- a clear line between bundle MCP, saved MCP config, and the MCP channel bridge

### P2: Clean Terminal UX And Duplicate Concepts

Terminal UX cleanup and duplicate concept cleanup are not cosmetic. They are how
Kova's vision becomes legible again. Treat the Control UI as legacy
compatibility unless the same workflow has a terminal path.

Use:

- [Duplicate And Hotspot Inventory](/plan/duplicate-hotspot-inventory)
- [Plugin Compatibility Cleanup](/plan/plugin-compatibility-cleanup)

## Bottom Line

Kova can reach reference-level user confidence without becoming another product.

The work is:

- clarify the default product path
- expose capability in matrices and UI
- turn memory plus skills into a visible learning loop
- add or explicitly reject checkpoint rollback
- continue reducing duplicate docs/config/compat surfaces

Feature count is not the blocker. Product coherence is.
