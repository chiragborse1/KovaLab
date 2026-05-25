---
summary: "CLI reference for `kova skills` (list/info/check)"
read_when:
  - You want to see which skills are available and ready to run
  - You want to debug missing binaries/env/config for skills
title: "Skills"
---

# `kova skills`

Inspect local skills.

Related:

- Skills system: [Skills](/tools/skills)
- Skills config: [Skills config](/tools/skills-config)
- KovaHub status: [KovaHub](/tools/kovahub)

## Commands

```bash
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

`list`/`info`/`check` inspect the local skills visible to the current workspace
and config. Workspace-backed commands resolve the target workspace from
`--agent <id>`, then the current working directory when it is inside a configured
agent workspace, then the default agent.

Inside an agent turn, Kova also exposes `skills_list` and `skill_view` tools so
the model can discover and load the same visible skills without guessing file
paths. Skill slash commands preload their `SKILL.md` before the model runs.

Notes:

- `--agent <id>` targets one configured agent workspace and overrides current
  working directory inference.
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
