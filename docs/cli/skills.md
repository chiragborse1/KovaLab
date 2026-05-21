---
summary: "CLI reference for `kova skills` (search/install/update/list/info/check)"
read_when:
  - You want to see which skills are available and ready to run
  - You want to search, install, or update skills from KovaHub
  - You want to debug missing binaries/env/config for skills
title: "Skills"
---

# `kova skills`

Inspect local skills and install/update skills from KovaHub.

Related:

- Skills system: [Skills](/tools/skills)
- Skills config: [Skills config](/tools/skills-config)
- KovaHub installs: [KovaHub](/tools/kovahub)

## Commands

```bash
kova skills search "calendar"
kova skills search --limit 20 --json
kova skills install <slug>
kova skills install <slug> --version <version>
kova skills install <slug> --force
kova skills install <slug> --agent <id>
kova skills install <slug> --global
kova skills update <slug>
kova skills update <slug> --global
kova skills update --all
kova skills update --all --agent <id>
kova skills update --all --global
kova skills list
kova skills list --eligible
kova skills list --json
kova skills list --verbose
kova skills info <name>
kova skills info <name> --json
kova skills check
kova skills check --json
kova skill-workshop review
kova skill-workshop inspect <proposal-id>
kova skill-workshop apply <proposal-id> --yes
kova skill-workshop reject <proposal-id>
kova skill-workshop quarantine
```

`search`/`install`/`update` use KovaHub directly. By default, `install` and
`update` target the active workspace `skills/` directory; with `--global`, they
target the shared managed skills directory. `list`/`info`/`check` still inspect
the local skills visible to the current workspace and config. Workspace-backed
commands resolve the target workspace from `--agent <id>`, then the current
working directory when it is inside a configured agent workspace, then the
default agent.

This CLI `install` command downloads skill folders from KovaHub. Gateway-backed
skill dependency installs triggered from onboarding or Skills settings use the
separate `skills.install` request path instead.

Notes:

- `search [query...]` accepts an optional query; omit it to browse the default
  KovaHub search feed.
- `search --limit <n>` caps returned results.
- `install --force` overwrites an existing workspace skill folder for the same
  slug.
- `--global` targets the shared managed skills directory and cannot be combined
  with `--agent <id>`.
- `--agent <id>` targets one configured agent workspace and overrides current
  working directory inference.
- `update <slug>` updates a single tracked skill. Add `--global` to target the
  shared managed skills directory instead of the workspace.
- `update --all` updates tracked KovaHub installs in the selected workspace, or
  in the shared managed skills directory when combined with `--global`.
- `list` is the default action when no subcommand is provided.
- `list`, `info`, and `check` write their rendered output to stdout. With
  `--json`, that means the machine-readable payload stays on stdout for pipes
  and scripts.

## Skill Workshop proposals

The optional [Skill Workshop plugin](/plugins/skill-workshop) stores generated
skill changes as workspace proposals. Review them from the terminal:

```bash
kova skill-workshop review
kova skill-workshop inspect <proposal-id>
kova skill-workshop apply <proposal-id> --yes
kova skill-workshop reject <proposal-id>
kova skill-workshop quarantine
```

`review`, `list`, `inspect`, and `quarantine` do not write skill files. `apply`
requires `--yes`, refuses quarantined proposals, and writes only to the selected
workspace `skills/` directory. It does not mutate the shared managed skills
directory.

## Related

- [CLI reference](/cli)
- [Skills](/tools/skills)
- [Skill Workshop plugin](/plugins/skill-workshop)
