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
kova skills update <slug>
kova skills update --all
kova skills list
kova skills list --eligible
kova skills list --json
kova skills list --verbose
kova skills info <name>
kova skills info <name> --json
kova skills check
kova skills check --json
```

`search`/`install`/`update` use KovaHub directly and install into the active
workspace `skills/` directory. `list`/`info`/`check` still inspect the local
skills visible to the current workspace and config.

This CLI `install` command downloads skill folders from KovaHub. Gateway-backed
skill dependency installs triggered from onboarding or Skills settings use the
separate `skills.install` request path instead.

Notes:

- `search [query...]` accepts an optional query; omit it to browse the default
  KovaHub search feed.
- `search --limit <n>` caps returned results.
- `install --force` overwrites an existing workspace skill folder for the same
  slug.
- `update --all` only updates tracked KovaHub installs in the active workspace.
- `list` is the default action when no subcommand is provided.
- `list`, `info`, and `check` write their rendered output to stdout. With
  `--json`, that means the machine-readable payload stays on stdout for pipes
  and scripts.

## Related

- [CLI reference](/cli)
- [Skills](/tools/skills)
