---
title: "Kova Product Spine Cleanup"
summary: "Plan for restoring one clear terminal-first architecture and product story across agents, plugins, automation, and memory"
read_when:
  - You are comparing Kova capabilities with another agent platform
  - You are deciding whether a new feature belongs in agents, automation, memory, plugins, or UI
  - You are removing duplicate Kova concepts or reconciling conflicting docs
---

## Status

Phase 0 and Phase 1 are in progress. Kova's current product direction is
terminal-first: `kova chat`, `kova status`, `kova settings`, `kova logs`, and
the TUI command center are the primary operator surfaces. The browser Control UI
is now treated as a legacy/optional surface, not the product spine.

## Progress

Done:

- Gateway default port contract aligned around `18789`.
- Canonical config path references aligned around `~/.kova/kova.json`.
- Agent docs now frame multi-agent routing as an advanced extension of the
  default single-agent model.
- Automation docs now describe one stack: hooks, cron, standing orders, Task
  Flow, background tasks, and heartbeat.
- Memory and context docs now separate durable storage, retrieval, context
  assembly, and compaction.
- Tools/plugins docs now state the ownership split between core contracts and
  plugin-owned behavior.
- Terminal-first docs now identify `kova chat` and `kova settings` as the daily
  control surfaces.
- Control UI work is frozen to compatibility, security, and release safety. New
  operator UX should land in CLI/TUI unless a platform app explicitly owns it.
- Duplicate and large-file hotspots have a static inventory in
  [Duplicate And Hotspot Inventory](/plan/duplicate-hotspot-inventory).
- Duplicate and large-file hotspots now have a repeatable static audit helper
  at `scripts/audit-kova-spine.mjs`.
- Plugin compatibility and doctor migration debt have an owner-aware cleanup
  plan in [Plugin Compatibility Cleanup](/plan/plugin-compatibility-cleanup).
- Plugin compatibility and doctor migration debt now have a repeatable owner,
  status, and removal-review report at `scripts/plugin-compat-report.mjs`.
- Plugin compatibility and doctor migration debt can now be reviewed from the
  terminal with `kova plugins compatibility-report`.
- Reference-agent capability parity has a refreshed review in
  [Reference Agent Capability Parity Review](/plan/reference-agent-capability-parity).
- Kova capability matrices now have a docs-derived inventory in
  [Kova Capability Matrices](/plan/kova-capability-matrices).
- `kova status`, `kova status --all`, and TUI docs now point users to the
  terminal commands that own channel, plugin, model, and sandbox capabilities.
- Core docs and CLI prompts now point ordinary administration toward terminal
  commands first, keeping the browser Control UI as optional compatibility.
- The first hotspot cleanup slice moved bundled runtime dependency Jiti aliasing
  out of the plugin loader into an owner-focused plugin helper module.
- Memory, Dream Diary review, memory promotion, and Skill Workshop proposals
  now have one terminal-first learning-loop story in
  [Learning Loop](/concepts/learning-loop), with `kova status` pointing to the
  review commands.
- Filesystem checkpoint/rollback now has an explicit decision and implementation
  plan in [Filesystem Checkpoint And Rollback](/plan/filesystem-checkpoint-rollback).
- MCP saved-server status, dynamic tool refresh, and sampling now have explicit
  runtime parity decisions in [MCP Runtime Parity](/plan/mcp-runtime-parity).
- Plugin capability ownership can now be refreshed from manifests with
  `scripts/plugin-capability-inventory.mjs`.
- Saved MCP server config can now be reviewed from the terminal with
  `kova mcp status` before any live probing or dynamic tool refresh work.
- Saved MCP server reachability can now be checked explicitly with
  `kova mcp status --probe` without launching stdio MCP servers by default.

Remaining:

- Continue hotspot cleanup one owner-boundary slice at a time.

## Goal

Kova should feel like one coherent local-first agent platform, not a bundle of
separate experiments. The product spine is:

- a local Gateway that owns control, routing, auth, and observability
- agent runtimes that do real work in explicit workspaces
- plugins that add providers, channels, tools, and harnesses without making core
  depend on bundled implementation details
- automation that schedules, triggers, tracks, and resumes work through one
  understandable model
- memory and context systems that improve agent continuity without hiding where
  recall, storage, compaction, and prompt assembly happen
- a terminal operator surface that makes setup, status, memory, skills, plugins,
  logs, and recovery usable without a browser

## Why This Exists

Kova already has a large amount of capability. The risk now is not that Kova is
too small; it is that the same product idea can be expressed through too many
overlapping concepts. Before adding another large feature, reconcile the
contracts users and contributors already depend on.

## Current Fractures

### Gateway And Config

- One canonical gateway default port must be used by config, runtime, clients,
  docs, container manifests, and examples.
- One canonical config file path must be used by runtime, setup docs, container
  docs, security docs, and CLI examples.
- Legacy paths should appear only in migration, doctor, or historical sections.

### Agent Model

Kova needs one official mental model:

- The default product experience is one personal agent controlled by the local
  Gateway.
- Multi-agent support is an advanced routing and isolation layer, not a second
  competing explanation of what Kova is.
- Docs should explain the default path first, then show how isolated agents,
  subagents, ACP, and embedded harnesses extend it.

### Automation Model

Automation should be described as one stack:

- hooks and cron trigger work
- standing orders define long-running authority
- Task Flow coordinates durable multi-step workflows
- background tasks track execution and delivery state
- goals are a user-facing facade, not a separate scheduler

If a new automation feature cannot fit into this stack, either the stack needs
updating or the feature probably duplicates an existing concept.

### Memory And Context

Memory and context should be separated by responsibility:

- memory stores facts and history
- active memory retrieves relevant material
- the context engine assembles prompt input
- QMD and transcript systems are storage or export formats, not separate product
  promises
- compaction is a context budget behavior, not a memory feature by default

Docs and UI should avoid presenting these as unrelated systems.

### Plugin Plane

The plugin architecture direction remains manifest-first:

- core uses manifests, registries, SDK contracts, and capability descriptors
- plugin runtime owns plugin-specific behavior
- compatibility entries need owners, replacement notes, and cleanup triggers
- broad mutable registries should continue shrinking toward targeted runtime
  loading

### Terminal Operator Surface

The CLI and TUI are the active product surfaces. New operator work should land
where terminal users already are:

- `kova chat` for local embedded runs
- `kova status --all` for pasteable diagnostics
- `kova settings` for common configuration
- `kova logs` for runtime logs
- TUI slash commands such as `/status`, `/tasks`, `/automation`, `/recover`,
  `/memory`, `/skills`, and `/plugins`

The browser Control UI remains compatibility surface area. Keep it secure and
buildable, but do not add new product-critical workflows there unless the same
workflow has a terminal path.

## Cleanup Phases

### Phase 0: Contract Alignment

Fix concrete contradictions first:

- gateway default port
- canonical config path
- container and setup examples
- generated/reference docs when behavior changes

### Phase 1: Product Spine Docs

Rewrite the core concept docs around one path:

- start with the default single-agent local Gateway experience
- layer multi-agent isolation after the default model
- explain automation as triggers, authority, workflows, and task state
- explain memory and context as separate responsibilities
- explain plugins as the extension model for everything not owned by core
- explain the browser UI as optional/legacy, never the required setup path

### Phase 2: Duplicate Inventory

Build a table of overlapping concepts before deleting anything:

- concept
- current owners
- public config/API/docs surface
- compatibility promise
- replacement or merge target
- tests that prove the replacement

Do not delete compatibility, config, or plugin-facing surfaces without a
documented migration path.

### Phase 3: Capability Parity Review

Compare external agent platforms feature by feature:

- what Kova already supports
- what Kova supports but exposes poorly
- what Kova lacks
- what should stay out of Kova
- what should be plugin-owned instead of core-owned

Parity should not mean copying another platform's structure. It should mean
closing real capability gaps while preserving Kova's local-first architecture.

## Non Goals

- Do not remove features only because they feel messy.
- Do not move plugin-owned behavior into core for convenience.
- Do not use web UI redesign as a substitute for architecture cleanup.
- Do not add large new automation or memory features until the existing model is
  documented and reconciled.
