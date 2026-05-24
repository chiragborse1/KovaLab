---
title: "Kova Product Spine Cleanup"
summary: "Plan for restoring one clear architecture and product story across agents, plugins, automation, memory, and UI"
read_when:
  - You are comparing Kova capabilities with another agent platform
  - You are deciding whether a new feature belongs in agents, automation, memory, plugins, or UI
  - You are removing duplicate Kova concepts or reconciling conflicting docs
---

## Status

Phase 0 and Phase 1 are in progress. The first pass aligned the default Gateway
port, canonical config path references, the initial product-spine docs, a fresh
reference-agent capability parity review, repeatable hotspot reporting, and
repeatable plugin compatibility reporting.

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
- Control UI design drift has a static cleanup plan in
  [Control UI Design Cleanup](/plan/control-ui-design-cleanup).
- Control UI Quick Settings has a first visual cleanup pass and contributor
  guardrails in `ui/AGENTS.md`.
- Duplicate and large-file hotspots have a static inventory in
  [Duplicate And Hotspot Inventory](/plan/duplicate-hotspot-inventory).
- Duplicate and large-file hotspots now have a repeatable static audit helper
  at `scripts/audit-kova-spine.mjs`.
- Plugin compatibility and doctor migration debt have an owner-aware cleanup
  plan in [Plugin Compatibility Cleanup](/plan/plugin-compatibility-cleanup).
- Plugin compatibility and doctor migration debt now have a repeatable owner,
  status, and removal-review report at `scripts/plugin-compat-report.mjs`.
- Reference-agent capability parity has a refreshed review in
  [Reference Agent Capability Parity Review](/plan/reference-agent-capability-parity).
- Kova capability matrices now have a docs-derived inventory in
  [Kova Capability Matrices](/plan/kova-capability-matrices).

Remaining:

- Continue Control UI design cleanup against `KOVA_DESIGN.md`, especially
  Control Panel and mobile navigation.
- Use the hotspot audit to choose one clear owner-boundary refactor at a time.
- Add a maintainer or release-facing command surface for the compatibility
  report before any removal-pending sweep.
- Move capability matrices into the user-facing docs and Control UI status
  surfaces where they can be maintained from manifests or owner docs.
- Closed-learning-loop cleanup: memory, dreaming, Skill Workshop, and skill
  proposal review as one product story.
- Filesystem checkpoint/rollback decision and implementation plan.
- MCP runtime parity decisions for saved-server status, dynamic tool refresh,
  and sampling.

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
- a Control UI that matches the documented Kova design language

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

### Control UI

The Control UI should either follow the documented Kova design language or the
design document should be changed. A cleanup pass should remove conflicting
surface-level patterns before adding more panels:

- no card-first layouts unless the design language explicitly allows them
- no decorative shadows, gradients, or rounded panel systems by default
- dense operator views should favor tables, panes, lists, and clear controls

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
- Do not use UI redesign as a substitute for architecture cleanup.
- Do not add large new automation or memory features until the existing model is
  documented and reconciled.
