---
summary: "KovaHub is planned for a future Kova marketplace release."
read_when:
  - Checking whether KovaHub registry installs are available
  - Planning future marketplace work
title: "KovaHub"
sidebarTitle: "KovaHub"
---

KovaHub is planned as Kova's future marketplace for skills and plugins.

The current Kova build does **not** include live KovaHub registry search, install,
update, publish, or sync flows.

## Current install paths

Use local folders, archives, npm packages, or configured marketplace entries:

```bash
kova plugins install ./my-plugin
kova plugins install ./my-plugin.tgz
kova plugins install npm:@scope/my-plugin
```

For skills, place a skill folder under a configured skill root such as:

```text
<workspace>/skills/<skill-name>/SKILL.md
~/.kova/skills/<skill-name>/SKILL.md
```

## Legacy cleanup

Older experimental builds may have recorded `kovahub:` plugin install metadata.
Kova keeps enough compatibility to let those records be inspected or removed,
but it no longer installs or updates from KovaHub.

## Future work

KovaHub will be added back when the marketplace is owned by Kova end to end:
registry contracts, publishing, review, install verification, update policy,
and docs will ship together.
