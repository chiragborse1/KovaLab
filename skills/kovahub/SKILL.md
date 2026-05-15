---
name: kovahub
description: Search, install, update, sync, or publish agent skills with the KovaHub CLI and registry.
metadata:
  {
    "kova":
      {
        "requires": { "bins": ["kovahub"] },
        "install":
          [
            {
              "id": "node",
              "kind": "node",
              "package": "kovahub",
              "bins": ["kovahub"],
              "label": "Install KovaHub CLI (npm)",
            },
          ],
      },
  }
---

# KovaHub CLI

Install

```bash
npm i -g kovahub
```

Auth (publish)

```bash
kovahub login
kovahub whoami
```

Search

```bash
kovahub search "postgres backups"
```

Install

```bash
kovahub install my-skill
kovahub install my-skill --version 1.2.3
```

Update (hash-based match + upgrade)

```bash
kovahub update my-skill
kovahub update my-skill --version 1.2.3
kovahub update --all
kovahub update my-skill --force
kovahub update --all --no-input --force
```

List

```bash
kovahub list
```

Publish

```bash
kovahub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```

Notes

- Default registry: https://kovahub.com (override with KOVAHUB_REGISTRY or --registry)
- Default workdir: cwd (falls back to Kova workspace); install dir: ./skills (override with --workdir / --dir / KOVAHUB_WORKDIR)
- Update command hashes local files, resolves matching version, and upgrades to latest unless --version is set
