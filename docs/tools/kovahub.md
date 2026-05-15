---
summary: "KovaHub: public registry for Kova skills and plugins, native install flows, and the kovahub CLI"
read_when:
  - Searching for, installing, or updating skills or plugins
  - Publishing skills or plugins to the registry
  - Configuring the kovahub CLI or its environment overrides
title: "KovaHub"
sidebarTitle: "KovaHub"
---

KovaHub is the public registry for **Kova skills and plugins**.

- Use native `kova` commands to search, install, and update skills, and to install plugins from KovaHub.
- Use the separate `kovahub` CLI for registry auth, publish, delete/undelete, and sync workflows.

Site: [kovahub.ai](https://kovahub.ai)

## Quick start

<Steps>
  <Step title="Search">
    ```bash
    kova skills search "calendar"
    ```
  </Step>
  <Step title="Install">
    ```bash
    kova skills install <skill-slug>
    ```
  </Step>
  <Step title="Use">
    Start a new Kova session — it picks up the new skill.
  </Step>
  <Step title="Publish (optional)">
    For registry-authenticated workflows (publish, sync, manage), install
    the separate `kovahub` CLI:

    ```bash
    npm i -g kovahub
    # or
    pnpm add -g kovahub
    ```

  </Step>
</Steps>

## Native Kova flows

<Tabs>
  <Tab title="Skills">
    ```bash
    kova skills search "calendar"
    kova skills install <skill-slug>
    kova skills update --all
    ```

    Native `kova` commands install into your active workspace and
    persist source metadata so later `update` calls can stay on KovaHub.

  </Tab>
  <Tab title="Plugins">
    ```bash
    kova plugins install kovahub:<package>
    kova plugins update --all
    ```

    Bare npm-safe plugin specs are also tried against KovaHub before npm:

    ```bash
    kova plugins install kova-codex-app-server
    ```

    Use `npm:<package>` when you want npm-only resolution without a
    KovaHub lookup:

    ```bash
    kova plugins install npm:kova-codex-app-server
    ```

    Plugin installs validate advertised `pluginApi` and
    `minGatewayVersion` compatibility before archive install runs, so
    incompatible hosts fail closed early instead of partially installing
    the package.

  </Tab>
</Tabs>

<Note>
`kova plugins install kovahub:...` only accepts installable plugin
families. If a KovaHub package is actually a skill, Kova stops and
points you at `kova skills install <slug>` instead.

Anonymous KovaHub plugin installs also fail closed for private packages.
Community or other non-official channels can still install, but Kova
warns so operators can review source and verification before enabling
them.
</Note>

## What KovaHub is

- A public registry for Kova skills and plugins.
- A versioned store of skill bundles and metadata.
- A discovery surface for search, tags, and usage signals.

A typical skill is a versioned bundle of files that includes:

- A `SKILL.md` file with the primary description and usage.
- Optional configs, scripts, or supporting files used by the skill.
- Metadata such as tags, summary, and install requirements.

KovaHub uses metadata to power discovery and safely expose skill
capabilities. The registry tracks usage signals (stars, downloads) to
improve ranking and visibility. Each publish creates a new semver
version, and the registry keeps version history so users can audit
changes.

## Workspace and skill loading

The separate `kovahub` CLI also installs skills into `./skills` under
your current working directory. If an Kova workspace is configured,
`kovahub` falls back to that workspace unless you override `--workdir`
(or `KOVAHUB_WORKDIR`). Kova loads workspace skills from
`<workspace>/skills` and picks them up in the **next** session.

If you already use `~/.kova/skills` or bundled skills, workspace
skills take precedence. For more detail on how skills are loaded,
shared, and gated, see [Skills](/tools/skills).

## Service features

| Feature            | Notes                                                      |
| ------------------ | ---------------------------------------------------------- |
| Public browsing    | Skills and their `SKILL.md` content are publicly viewable. |
| Search             | Embedding-powered (vector search), not just keywords.      |
| Versioning         | Semver, changelogs, and tags (including `latest`).         |
| Downloads          | Zip per version.                                           |
| Stars and comments | Community feedback.                                        |
| Moderation         | Approvals and audits.                                      |
| CLI-friendly API   | Suitable for automation and scripting.                     |

## Security and moderation

KovaHub is open by default — anyone can upload skills, but a GitHub
account must be **at least one week old** to publish. This slows down
abuse without blocking legitimate contributors.

<AccordionGroup>
  <Accordion title="Reporting">
    - Any signed-in user can report a skill.
    - Report reasons are required and recorded.
    - Each user can have up to 20 active reports at a time.
    - Skills with more than 3 unique reports are auto-hidden by default.
  </Accordion>
  <Accordion title="Moderation">
    - Moderators can view hidden skills, unhide them, delete them, or ban users.
    - Abusing the report feature can result in account bans.
    - Interested in becoming a moderator? Ask in the Kova Discord and contact a moderator or maintainer.
  </Accordion>
</AccordionGroup>

## KovaHub CLI

You only need this for registry-authenticated workflows such as
publish/sync.

### Global options

<ParamField path="--workdir <dir>" type="string">
  Working directory. Default: current dir; falls back to Kova workspace.
</ParamField>
<ParamField path="--dir <dir>" type="string" default="skills">
  Skills directory, relative to workdir.
</ParamField>
<ParamField path="--site <url>" type="string">
  Site base URL (browser login).
</ParamField>
<ParamField path="--registry <url>" type="string">
  Registry API base URL.
</ParamField>
<ParamField path="--no-input" type="boolean">
  Disable prompts (non-interactive).
</ParamField>
<ParamField path="-V, --cli-version" type="boolean">
  Print CLI version.
</ParamField>

### Commands

<AccordionGroup>
  <Accordion title="Auth (login / logout / whoami)">
    ```bash
    kovahub login              # browser flow
    kovahub login --token <token>
    kovahub logout
    kovahub whoami
    ```

    Login options:

    - `--token <token>` — paste an API token.
    - `--label <label>` — label stored for browser login tokens (default: `CLI token`).
    - `--no-browser` — do not open a browser (requires `--token`).

  </Accordion>
  <Accordion title="Search">
    ```bash
    kovahub search "query"
    ```

    - `--limit <n>` — max results.

  </Accordion>
  <Accordion title="Install / update / list">
    ```bash
    kovahub install <slug>
    kovahub update <slug>
    kovahub update --all
    kovahub list
    ```

    Options:

    - `--version <version>` — install or update to a specific version (single slug only on `update`).
    - `--force` — overwrite if the folder already exists, or when local files do not match any published version.
    - `kovahub list` reads `.kovahub/lock.json`.

  </Accordion>
  <Accordion title="Publish skills">
    ```bash
    kovahub skill publish <path>
    ```

    Options:

    - `--slug <slug>` — skill slug.
    - `--name <name>` — display name.
    - `--version <version>` — semver version.
    - `--changelog <text>` — changelog text (can be empty).
    - `--tags <tags>` — comma-separated tags (default: `latest`).

  </Accordion>
  <Accordion title="Publish plugins">
    ```bash
    kovahub package publish <source>
    ```

    `<source>` can be a local folder, `owner/repo`, `owner/repo@ref`, or a
    GitHub URL.

    Options:

    - `--dry-run` — build the exact publish plan without uploading anything.
    - `--json` — emit machine-readable output for CI.
    - `--source-repo`, `--source-commit`, `--source-ref` — optional overrides when auto-detection is not enough.

  </Accordion>
  <Accordion title="Delete / undelete (owner or admin)">
    ```bash
    kovahub delete <slug> --yes
    kovahub undelete <slug> --yes
    ```
  </Accordion>
  <Accordion title="Sync (scan local + publish new or updated)">
    ```bash
    kovahub sync
    ```

    Options:

    - `--root <dir...>` — extra scan roots.
    - `--all` — upload everything without prompts.
    - `--dry-run` — show what would be uploaded.
    - `--bump <type>` — `patch|minor|major` for updates (default: `patch`).
    - `--changelog <text>` — changelog for non-interactive updates.
    - `--tags <tags>` — comma-separated tags (default: `latest`).
    - `--concurrency <n>` — registry checks (default: `4`).

  </Accordion>
</AccordionGroup>

## Common workflows

<Tabs>
  <Tab title="Search">
    ```bash
    kovahub search "postgres backups"
    ```
  </Tab>
  <Tab title="Install">
    ```bash
    kovahub install my-skill-pack
    ```
  </Tab>
  <Tab title="Update all">
    ```bash
    kovahub update --all
    ```
  </Tab>
  <Tab title="Publish a single skill">
    ```bash
    kovahub skill publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0 --tags latest
    ```
  </Tab>
  <Tab title="Sync many skills">
    ```bash
    kovahub sync --all
    ```
  </Tab>
  <Tab title="Publish a plugin from GitHub">
    ```bash
    kovahub package publish your-org/your-plugin --dry-run
    kovahub package publish your-org/your-plugin
    kovahub package publish your-org/your-plugin@v1.0.0
    kovahub package publish https://github.com/your-org/your-plugin
    ```
  </Tab>
</Tabs>

### Plugin package metadata

Code plugins must include the required Kova metadata in
`package.json`:

```json
{
  "name": "@myorg/kova-my-plugin",
  "version": "1.0.0",
  "type": "module",
  "kova": {
    "extensions": ["./src/index.ts"],
    "runtimeExtensions": ["./dist/index.js"],
    "compat": {
      "pluginApi": ">=2026.3.24-beta.2",
      "minGatewayVersion": "2026.3.24-beta.2"
    },
    "build": {
      "kovaVersion": "2026.3.24-beta.2",
      "pluginSdkVersion": "2026.3.24-beta.2"
    }
  }
}
```

Published packages should ship **built JavaScript** and point
`runtimeExtensions` at that output. Git checkout installs can still fall
back to TypeScript source when no built files exist, but built runtime
entries avoid runtime TypeScript compilation in startup, doctor, and
plugin loading paths.

## Versioning, lockfile, and telemetry

<AccordionGroup>
  <Accordion title="Versioning and tags">
    - Each publish creates a new **semver** `SkillVersion`.
    - Tags (like `latest`) point to a version; moving tags lets you roll back.
    - Changelogs are attached per version and can be empty when syncing or publishing updates.
  </Accordion>
  <Accordion title="Local changes vs registry versions">
    Updates compare the local skill contents to registry versions using a
    content hash. If local files do not match any published version, the
    CLI asks before overwriting (or requires `--force` in
    non-interactive runs).
  </Accordion>
  <Accordion title="Sync scanning and fallback roots">
    `kovahub sync` scans your current workdir first. If no skills are
    found, it falls back to known legacy locations (for example
    `~/kova/skills` and `~/.kova/skills`). This is designed to
    find older skill installs without extra flags.
  </Accordion>
  <Accordion title="Storage and lockfile">
    - Installed skills are recorded in `.kovahub/lock.json` under your workdir.
    - Auth tokens are stored in the KovaHub CLI config file (override via `KOVAHUB_CONFIG_PATH`).
  </Accordion>
  <Accordion title="Telemetry (install counts)">
    When you run `kovahub sync` while logged in, the CLI sends a minimal
    snapshot to compute install counts. You can disable this entirely:

    ```bash
    export KOVAHUB_DISABLE_TELEMETRY=1
    ```

  </Accordion>
</AccordionGroup>

## Environment variables

| Variable                      | Effect                                          |
| ----------------------------- | ----------------------------------------------- |
| `KOVAHUB_SITE`                | Override the site URL.                          |
| `KOVAHUB_REGISTRY`            | Override the registry API URL.                  |
| `KOVAHUB_CONFIG_PATH`         | Override where the CLI stores the token/config. |
| `KOVAHUB_WORKDIR`             | Override the default workdir.                   |
| `KOVAHUB_DISABLE_TELEMETRY=1` | Disable telemetry on `sync`.                    |

## Related

- [Community plugins](/plugins/community)
- [Plugins](/tools/plugin)
- [Skills](/tools/skills)
