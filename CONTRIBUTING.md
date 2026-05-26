# Contributing to Kova

Kova is a terminal-first, local-first AI agent. The default path is simple:

```bash
kova onboard
kova
```

The Gateway, plugins, channels, memory, skills, apps, and web surfaces exist to
support that product spine. Contributions should make Kova easier to install,
safer to operate, faster to use, or clearer to extend.

## Links

- GitHub: https://github.com/chiragborse1/KovaLab
- Website: https://www.neuralstudio.in/
- Docs: https://docs.neuralstudio.in/
- Discord: https://discord.gg/uT9ETzpaHT
- Support: SUPPORT.md
- Code of Conduct: CODE_OF_CONDUCT.md
- Issues: https://github.com/chiragborse1/KovaLab/issues/new/choose

## Current Priorities

We prioritize work in this order:

1. Release blockers: install, update, onboarding, packaging, CI, and fresh-run failures.
2. Reliability: crashes, data loss, stuck runs, broken channel delivery, broken model/provider routing.
3. Security hardening: auth, sandboxing, approvals, plugin loading, secret handling, and trusted-boundary clarity.
4. Terminal-first UX: `kova`, slash commands, status, settings, logs, permissions, memory, skills, and plugin workflows.
5. Performance: startup latency, first-token delay, event-loop stalls, memory pressure, and unnecessary background work.
6. Docs that help real users install, configure, recover, or extend Kova.
7. New capabilities that fit Kova's plugin-first architecture.

If a change does not clearly fit one of these buckets, open an issue first.

## What Belongs Where

Kova is intentionally plugin-first. Put behavior in the smallest owner that can
hold it without making core depend on a specific integration.

| Change type                          | Preferred home                                        |
| ------------------------------------ | ----------------------------------------------------- |
| Provider integration                 | `extensions/<provider>`                               |
| Chat/channel integration             | `extensions/<channel>`                                |
| Tool backed by a service or runtime  | plugin in `extensions/`                               |
| Reusable user procedure              | `skills/<skill>` or workspace skill                   |
| Gateway protocol or routing contract | `src/gateway/protocol` and docs                       |
| Terminal operator workflow           | CLI/TUI under `src/cli`, `src/commands`, or `src/tui` |
| Docs-only user guidance              | `docs/` plus README when it is a first-run surface    |

Do not move plugin-owned behavior into core just because it is convenient.
Core should expose generic seams; integrations should own their defaults,
setup, repair, and runtime-specific behavior.

## Feature Boundaries

Before adding a feature, ask:

- Does this help the terminal-first product path?
- Can this be a skill instead of a plugin?
- Can this be a plugin instead of core?
- Is the behavior safe for a local-first personal agent?
- Is there a test or live proof that matches how users will actually run it?

Kova does not accept features solely because another agent has them. Reference
projects are useful for learning, but Kova should keep its own architecture:
local-first Gateway, terminal-first controls, reviewable memory and skills,
manifest-first plugins, and explicit security boundaries.

## Development Setup

Requirements:

- Node 24 recommended, Node 22.14+ supported.
- pnpm 10.x.
- Git.
- Docker only when validating Docker or sandbox behavior.

Install:

```bash
pnpm install
```

Run from source:

```bash
pnpm kova onboard
pnpm kova
```

Build:

```bash
pnpm build
```

## Docs First

Before working in docs, run:

```bash
pnpm docs:list
```

Read only the docs that match the `Read when` hints for your change. Keep docs
generic: no personal hostnames, local secrets, phone numbers, or private paths.

Use "plugins" in public docs and UI. `extensions/` is the internal source-tree
name.

## Checks

Use the smallest check that proves the touched behavior.

Common checks:

```bash
pnpm build
pnpm check:changed
pnpm test:changed
pnpm test <path-or-filter>
pnpm release:check
```

Formatting:

```bash
pnpm exec oxfmt --check --threads=1 <files...>
pnpm exec oxfmt --write --threads=1 <files...>
```

Do not run raw `vitest`; use repo scripts such as `pnpm test`. Do not add
`tsc --noEmit` lanes; this repo uses `tsgo` wrappers.

If your machine cannot run heavy checks safely, say exactly what you did run and
which CI check should be treated as authoritative. Do not pretend local proof is
stronger than it is.

## Pull Requests

Keep PRs focused. One PR should explain one problem and one solution.

Every PR should include:

- What bug, feature, or user problem is being addressed.
- What changed.
- What did not change.
- Real behavior proof when the change affects runtime behavior.
- Tests or checks run.
- Security impact.
- Screenshots or terminal captures for UI/TUI/CLI output changes.

External PRs must include real behavior proof from a real Kova setup. Unit
tests, mocks, snapshots, lint, type checks, and CI are useful, but they are not
the same as proving the user workflow works.

Do not edit `CHANGELOG.md` in normal contributor PRs unless a maintainer asks.
Maintainers prepare release notes from commit history before release.

## AI-Assisted Contributions

AI-assisted PRs are welcome, but they need the same proof as human-written PRs.

If an AI tool helped, say so in the PR body and include:

- What the tool changed.
- What you personally reviewed.
- What you personally tested.
- Any prompts or session notes that help reviewers understand the work.

You are still responsible for the code.

## Security-Sensitive Changes

Read `SECURITY.md` before touching:

- Gateway auth, tokens, pairing, trusted proxy, or HTTP surfaces.
- Exec approvals, sandboxing, elevated mode, or node execution.
- Plugin install/load/update paths.
- Secret storage, redaction, or credential routing.
- Channel allowlists, group behavior, sender identity, or message routing.
- Browser, media, file, archive, or path-handling code.

If you found a vulnerability, do not open a public issue or PR with exploit
details. Use GitHub Security Advisories or the private security contact listed
in `SECURITY.md`.

## Code Style

- TypeScript ESM.
- Prefer real types over `any`.
- Validate external data at boundaries.
- Keep comments brief and useful.
- Use American English in code, docs, and UI.
- Keep compatibility changes documented and tested.
- Do not add broad core registries when a manifest or plugin-owned contract can
  express the behavior.

## Plugins and Skills

Plugins are trusted code. Add a bundled plugin only when it is broad, maintained,
and cannot be a skill.

Skills are the right home when the capability can be expressed as instructions,
shell commands, existing tools, or a small procedure. Specialized or personal
skills should live in the user's workspace. KovaHub is planned for a future
marketplace release; do not document it as a live registry until it ships end to
end.

## Commit and Branch Workflow

For local commits, use:

```bash
scripts/committer "type(scope): summary" <files...>
```

Stage intended files only. Do not revert unrelated local changes. If the work
touches generated config/API baselines, regenerate and commit the matching
generated hash files.

## Maintainers

Kova maintainer access is earned through sustained, high-quality contributions:
bug fixes, careful reviews, reliable release work, documentation, security
hardening, and community support.

If you want to help maintain Kova, start by contributing focused PRs and helping
users in issues or Discord. Maintainer invitations are handled privately.

## Getting Help

Use Discord for setup questions, usage help, and early contributor discussion:
https://discord.gg/uT9ETzpaHT

For bugs, feature requests, and reproducible problems, use GitHub Issues:
https://github.com/chiragborse1/KovaLab/issues/new/choose
