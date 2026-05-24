---
summary: "CLI reference for `kova plugins` (list, install, marketplace, uninstall, enable/disable, doctor, compatibility reports)"
read_when:
  - You want to install or manage Gateway plugins or compatible bundles
  - You want to debug plugin load failures
title: "Plugins"
sidebarTitle: "Plugins"
---

Manage Gateway plugins, hook packs, and compatible bundles.

<CardGroup cols={2}>
  <Card title="Plugin system" href="/tools/plugin">
    End-user guide for installing, enabling, and troubleshooting plugins.
  </Card>
  <Card title="Plugin bundles" href="/plugins/bundles">
    Bundle compatibility model.
  </Card>
  <Card title="Plugin manifest" href="/plugins/manifest">
    Manifest fields and config schema.
  </Card>
  <Card title="Security" href="/gateway/security">
    Security hardening for plugin installs.
  </Card>
</CardGroup>

## Commands

```bash
kova plugins list
kova plugins list --enabled
kova plugins list --verbose
kova plugins list --json
kova plugins install <path-or-spec>
kova plugins inspect <id>
kova plugins inspect <id> --json
kova plugins inspect --all
kova plugins info <id>
kova plugins enable <id>
kova plugins disable <id>
kova plugins init <id>
kova plugins build --entry ./dist/index.js
kova plugins build --entry ./dist/index.js --check
kova plugins validate --entry ./dist/index.js
kova plugins registry
kova plugins registry --refresh
kova plugins compatibility-report
kova plugins compatibility-report --json
kova plugins uninstall <id>
kova plugins doctor
kova plugins update <id-or-npm-spec>
kova plugins update --all
kova plugins marketplace list <marketplace>
kova plugins marketplace list <marketplace> --json
```

<Note>
Bundled plugins ship with Kova. Some are enabled by default (for example bundled model providers, bundled speech providers, and the bundled browser plugin); others require `plugins enable`.

Native Kova plugins must ship `kova.plugin.json` with an inline JSON Schema (`configSchema`, even if empty). Compatible bundles use their own bundle manifests instead.

`plugins list` shows `Format: kova` or `Format: bundle`. Verbose list/info output also shows the bundle subtype (`codex`, `claude`, or `cursor`) plus detected bundle capabilities.
</Note>

### Author Tool Plugins

For simple agent-tool packages, use the authoring commands:

```bash
kova plugins init stock-quotes --name "Stock Quotes"
kova plugins build --root ./stock-quotes --entry ./dist/index.js
kova plugins build --root ./stock-quotes --entry ./dist/index.js --check
kova plugins validate --root ./stock-quotes --entry ./dist/index.js
```

`plugins init` creates a small TypeScript tool plugin. `plugins build`
generates `kova.plugin.json` and aligns `package.json#kova.extensions`.
`plugins validate` verifies that generated metadata still matches the plugin
entry. See [Tool plugins](/plugins/tool-plugins).

### Install

```bash
kova plugins install <package>                      # KovaHub first, then npm
kova plugins install kovahub:<package>              # KovaHub only
kova plugins install npm:<package>                  # npm only
kova plugins install <package> --force              # overwrite existing install
kova plugins install <package> --pin                # pin version
kova plugins install <package> --dangerously-force-unsafe-install
kova plugins install <path>                         # local path
kova plugins install <plugin>@<marketplace>         # marketplace
kova plugins install <plugin> --marketplace <name>  # marketplace (explicit)
kova plugins install <plugin> --marketplace https://github.com/<owner>/<repo>
```

<Warning>
Bare package names are checked against KovaHub first, then npm. Treat plugin installs like running code. Prefer pinned versions.
</Warning>

<AccordionGroup>
  <Accordion title="Config includes and invalid-config recovery">
    If your `plugins` section is backed by a single-file `$include`, `plugins install/update/enable/disable/uninstall` write through to that included file and leave `kova.json` untouched. Root includes, include arrays, and includes with sibling overrides fail closed instead of flattening. See [Config includes](/gateway/configuration) for the supported shapes.

    If config is invalid during install, `plugins install` normally fails closed and tells you to run `kova doctor --fix` first. During Gateway startup, invalid config for one plugin is isolated to that plugin so other channels and plugins can keep running; `kova doctor --fix` can quarantine the invalid plugin entry. The only documented install-time exception is a narrow bundled-plugin recovery path for plugins that explicitly opt into `kova.install.allowInvalidConfigRecovery`.

  </Accordion>
  <Accordion title="--force and reinstall vs update">
    `--force` reuses the existing install target and overwrites an already-installed plugin or hook pack in place. Use it when you are intentionally reinstalling the same id from a new local path, archive, KovaHub package, or npm artifact. For routine upgrades of an already tracked npm plugin, prefer `kova plugins update <id-or-npm-spec>`.

    If you run `plugins install` for a plugin id that is already installed, Kova stops and points you at `plugins update <id-or-npm-spec>` for a normal upgrade, or at `plugins install <package> --force` when you genuinely want to overwrite the current install from a different source.

  </Accordion>
  <Accordion title="--pin scope">
    `--pin` applies to npm installs only. It is not supported with `--marketplace`, because marketplace installs persist marketplace source metadata instead of an npm spec.
  </Accordion>
  <Accordion title="--dangerously-force-unsafe-install">
    `--dangerously-force-unsafe-install` is a break-glass option for false positives in the built-in dangerous-code scanner. It allows the install to continue even when the built-in scanner reports `critical` findings, but it does **not** bypass plugin `before_install` hook policy blocks and does **not** bypass scan failures.

    This CLI flag applies to plugin install/update flows. Gateway-backed skill dependency installs use the matching `dangerouslyForceUnsafeInstall` request override, while `kova skills install` remains a separate KovaHub skill download/install flow.

  </Accordion>
  <Accordion title="Hook packs and npm specs">
    `plugins install` is also the install surface for hook packs that expose `kova.hooks` in `package.json`. Use `kova hooks` for filtered hook visibility and per-hook enablement, not package installation.

    Npm specs are **registry-only** (package name + optional **exact version** or **dist-tag**). Git/URL/file specs and semver ranges are rejected. Dependency installs run project-local with `--ignore-scripts` for safety, even when your shell has global npm install settings.

    Use `npm:<package>` when you want to skip KovaHub lookup and install directly from npm. Bare package specs still prefer KovaHub and only fall back to npm when KovaHub does not have that package or version.

    Bare specs and `@latest` stay on the stable track. If npm resolves either of those to a prerelease, Kova stops and asks you to opt in explicitly with a prerelease tag such as `@beta`/`@rc` or an exact prerelease version such as `@1.2.3-beta.4`.

    If a bare install spec matches a bundled plugin id (for example `diffs`), Kova installs the bundled plugin directly. To install an npm package with the same name, use an explicit scoped spec (for example `@scope/diffs`).

  </Accordion>
  <Accordion title="Archives">
    Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`. Native Kova plugin archives must contain a valid `kova.plugin.json` at the extracted plugin root; archives that only contain `package.json` are rejected before Kova writes install records.

    Claude marketplace installs are also supported.

  </Accordion>
</AccordionGroup>

KovaHub installs use an explicit `kovahub:<package>` locator:

```bash
kova plugins install kovahub:kova-codex-app-server
kova plugins install kovahub:kova-codex-app-server@1.2.3
```

Kova now also prefers KovaHub for bare npm-safe plugin specs. It only falls back to npm if KovaHub does not have that package or version:

```bash
kova plugins install kova-codex-app-server
```

Use `npm:` to force npm-only resolution, for example when KovaHub is unreachable or you know the package exists only on npm:

```bash
kova plugins install npm:kova-codex-app-server
kova plugins install npm:@scope/plugin-name@1.0.1
```

Kova downloads the package archive from KovaHub, checks the advertised plugin API / minimum gateway compatibility, then installs it through the normal archive path. Recorded installs keep their KovaHub source metadata for later updates.
Unversioned KovaHub installs keep an unversioned recorded spec so `kova plugins update` can follow newer KovaHub releases; explicit version or tag selectors such as `kovahub:pkg@1.2.3` and `kovahub:pkg@beta` remain pinned to that selector.

#### Marketplace shorthand

Use `plugin@marketplace` shorthand when the marketplace name exists in Claude's local registry cache at `~/.claude/plugins/known_marketplaces.json`:

```bash
kova plugins marketplace list <marketplace-name>
kova plugins install <plugin-name>@<marketplace-name>
```

Use `--marketplace` when you want to pass the marketplace source explicitly:

```bash
kova plugins install <plugin-name> --marketplace <marketplace-name>
kova plugins install <plugin-name> --marketplace <owner/repo>
kova plugins install <plugin-name> --marketplace https://github.com/<owner>/<repo>
kova plugins install <plugin-name> --marketplace ./my-marketplace
```

<Tabs>
  <Tab title="Marketplace sources">
    - a Claude known-marketplace name from `~/.claude/plugins/known_marketplaces.json`
    - a local marketplace root or `marketplace.json` path
    - a GitHub repo shorthand such as `owner/repo`
    - a GitHub repo URL such as `https://github.com/owner/repo`
    - a git URL
  </Tab>
  <Tab title="Remote marketplace rules">
    For remote marketplaces loaded from GitHub or git, plugin entries must stay inside the cloned marketplace repo. Kova accepts relative path sources from that repo and rejects HTTP(S), absolute-path, git, GitHub, and other non-path plugin sources from remote manifests.
  </Tab>
</Tabs>

For local paths and archives, Kova auto-detects:

- native Kova plugins (`kova.plugin.json`)
- Codex-compatible bundles (`.codex-plugin/plugin.json`)
- Claude-compatible bundles (`.claude-plugin/plugin.json` or the default Claude component layout)
- Cursor-compatible bundles (`.cursor-plugin/plugin.json`)

<Note>
Compatible bundles install into the normal plugin root and participate in the same list/info/enable/disable flow. Today, bundle skills, Claude command-skills, Claude `settings.json` defaults, Claude `.lsp.json` / manifest-declared `lspServers` defaults, Cursor command-skills, and compatible Codex hook directories are supported; other detected bundle capabilities are shown in diagnostics/info but are not yet wired into runtime execution.
</Note>

### List

```bash
kova plugins list
kova plugins list --enabled
kova plugins list --verbose
kova plugins list --json
```

<ParamField path="--enabled" type="boolean">
  Show only enabled plugins.
</ParamField>
<ParamField path="--verbose" type="boolean">
  Switch from the table view to per-plugin detail lines with source/origin/version/activation metadata.
</ParamField>
<ParamField path="--json" type="boolean">
  Machine-readable inventory plus registry diagnostics.
</ParamField>

<Note>
`plugins list` reads the persisted local plugin registry first, with a manifest-only derived fallback when the registry is missing or invalid. It is useful for checking whether a plugin is installed, enabled, and visible to cold startup planning, but it is not a live runtime probe of an already-running Gateway process. After changing plugin code, enablement, hook policy, or `plugins.load.paths`, restart the Gateway that serves the channel before expecting new `register(api)` code or hooks to run. For remote/container deployments, verify you are restarting the actual `kova gateway run` child, not only a wrapper process.
</Note>

For bundled plugin work inside a packaged Docker image, bind-mount the plugin
source directory over the matching packaged source path, such as
`/app/extensions/synology-chat`. Kova will discover that mounted source
overlay before `/app/dist/extensions/synology-chat`; a plain copied source
directory remains inert so normal packaged installs still use compiled dist.

For runtime hook debugging:

- `kova plugins inspect <id> --json` shows registered hooks and diagnostics from a module-loaded inspection pass.
- `kova gateway status --deep --require-rpc` confirms the reachable Gateway, service/process hints, config path, and RPC health.
- Non-bundled conversation hooks (`llm_input`, `llm_output`, `before_agent_finalize`, `agent_end`) require `plugins.entries.<id>.hooks.allowConversationAccess=true`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
kova plugins install -l ./my-plugin
```

<Note>
`--force` is not supported with `--link` because linked installs reuse the source path instead of copying over a managed install target.

Use `--pin` on npm installs to save the resolved exact spec (`name@version`) in the managed plugin index while keeping the default behavior unpinned.
</Note>

### Plugin index

Plugin install metadata is machine-managed state, not user config. Installs and updates write it to `plugins/installs.json` under the active Kova state directory. Its top-level `installRecords` map is the durable source of install metadata, including records for broken or missing plugin manifests. The `plugins` array is the manifest-derived cold registry cache. The file includes a do-not-edit warning and is used by `kova plugins update`, uninstall, diagnostics, and the cold plugin registry.

When Kova sees shipped legacy `plugins.installs` records in config, it moves them into the plugin index and removes the config key; if either write fails, the config records are kept so the install metadata is not lost.

### Uninstall

```bash
kova plugins uninstall <id>
kova plugins uninstall <id> --dry-run
kova plugins uninstall <id> --keep-files
```

`uninstall` removes plugin records from `plugins.entries`, the persisted plugin index, plugin allow/deny list entries, and linked `plugins.load.paths` entries when applicable. Unless `--keep-files` is set, uninstall also removes the tracked managed install directory when it is inside Kova's plugin extensions root. For active memory plugins, the memory slot resets to `memory-core`.

<Note>
`--keep-config` is supported as a deprecated alias for `--keep-files`.
</Note>

### Update

```bash
kova plugins update <id-or-npm-spec>
kova plugins update --all
kova plugins update <id-or-npm-spec> --dry-run
kova plugins update @kovaai/voice-call@beta
kova plugins update kova-codex-app-server --dangerously-force-unsafe-install
```

Updates apply to tracked plugin installs in the managed plugin index and tracked hook-pack installs in `hooks.internal.installs`.

<AccordionGroup>
  <Accordion title="Resolving plugin id vs npm spec">
    When you pass a plugin id, Kova reuses the recorded install spec for that plugin. That means previously stored dist-tags such as `@beta` and exact pinned versions continue to be used on later `update <id>` runs.

    For npm installs, you can also pass an explicit npm package spec with a dist-tag or exact version. Kova resolves that package name back to the tracked plugin record, updates that installed plugin, and records the new npm spec for future id-based updates.

    Passing the npm package name without a version or tag also resolves back to the tracked plugin record. Use this when a plugin was pinned to an exact version and you want to move it back to the registry's default release line.

  </Accordion>
  <Accordion title="Version checks and integrity drift">
    Before a live npm update, Kova checks the installed package version against the npm registry metadata. If the installed version and recorded artifact identity already match the resolved target, the update is skipped without downloading, reinstalling, or rewriting `kova.json`.

    When a stored integrity hash exists and the fetched artifact hash changes, Kova treats that as npm artifact drift. The interactive `kova plugins update` command prints the expected and actual hashes and asks for confirmation before proceeding. Non-interactive update helpers fail closed unless the caller supplies an explicit continuation policy.

  </Accordion>
  <Accordion title="--dangerously-force-unsafe-install on update">
    `--dangerously-force-unsafe-install` is also available on `plugins update` as a break-glass override for built-in dangerous-code scan false positives during plugin updates. It still does not bypass plugin `before_install` policy blocks or scan-failure blocking, and it only applies to plugin updates, not hook-pack updates.
  </Accordion>
</AccordionGroup>

### Inspect

```bash
kova plugins inspect <id>
kova plugins inspect <id> --json
```

Deep introspection for a single plugin. Shows identity, load status, source, registered capabilities, hooks, tools, commands, services, gateway methods, HTTP routes, policy flags, diagnostics, install metadata, bundle capabilities, and any detected MCP or LSP server support.

Each plugin is classified by what it actually registers at runtime:

- **plain-capability** — one capability type (e.g. a provider-only plugin)
- **hybrid-capability** — multiple capability types (e.g. text + speech + images)
- **hook-only** — only hooks, no capabilities or surfaces
- **non-capability** — tools/commands/services but no capabilities

See [Plugin shapes](/plugins/architecture#plugin-shapes) for more on the capability model.

<Note>
The `--json` flag outputs a machine-readable report suitable for scripting and auditing. `inspect --all` renders a fleet-wide table with shape, capability kinds, compatibility notices, bundle capabilities, and hook summary columns. `info` is an alias for `inspect`.
</Note>

### Doctor

```bash
kova plugins doctor
```

`doctor` reports plugin load errors, manifest/discovery diagnostics, and compatibility notices. When everything is clean it prints `No plugin issues detected.`

For module-shape failures such as missing `register`/`activate` exports, rerun with `KOVA_PLUGIN_LOAD_DEBUG=1` to include a compact export-shape summary in the diagnostic output.

### Registry

```bash
kova plugins registry
kova plugins registry --refresh
kova plugins registry --json
```

The local plugin registry is Kova's persisted cold read model for installed plugin identity, enablement, source metadata, and contribution ownership. Normal startup, provider owner lookup, channel setup classification, and plugin inventory can read it without importing plugin runtime modules.

Use `plugins registry` to inspect whether the persisted registry is present, current, or stale. Use `--refresh` to rebuild it from the persisted plugin index, config policy, and manifest/package metadata. This is a repair path, not a runtime activation path.

<Warning>
`KOVA_DISABLE_PERSISTED_PLUGIN_REGISTRY=1` is a deprecated break-glass compatibility switch for registry read failures. Prefer `plugins registry --refresh` or `kova doctor --fix`; the env fallback is only for emergency startup recovery while the migration rolls out.
</Warning>

### Compatibility Report

```bash
kova plugins compatibility-report
kova plugins compatibility-report --json
kova plugins compatibility-report --owner sdk,provider --due-days 120
```

`compatibility-report` is a maintainer-facing source-checkout command for plugin compatibility and doctor deprecation cleanup. It reports owner counts, status counts, and removal-review entries before any deprecated or removal-pending behavior is swept. `compat-report` is a shorter alias.

### Marketplace

```bash
kova plugins marketplace list <source>
kova plugins marketplace list <source> --json
```

Marketplace list accepts a local marketplace path, a `marketplace.json` path, a GitHub shorthand like `owner/repo`, a GitHub repo URL, or a git URL. `--json` prints the resolved source label plus the parsed marketplace manifest and plugin entries.

## Related

- [Building plugins](/plugins/building-plugins)
- [CLI reference](/cli)
- [Community plugins](/plugins/community)
