---
summary: "Configure native Codex plugins for Codex-mode Kova agents"
title: "Native Codex plugins"
read_when:
  - You want Codex-mode Kova agents to use native Codex plugins
  - You are troubleshooting codexPlugins config or /codex plugins commands
  - You need to understand how Codex app plugins differ from Kova dynamic tools
---

Native Codex plugin support lets a Codex-mode Kova agent use Codex app-server's
own app and plugin capabilities inside the same Codex thread that handles the
Kova turn.

Kova does not translate Codex plugins into synthetic Kova dynamic tools. Plugin
calls stay in the native Codex transcript, and Codex app-server owns the
app-backed MCP execution.

Use this page after the base [Codex harness](/plugins/codex-harness) is working.

## Requirements

- The selected Kova agent runtime must be the native Codex harness.
- `plugins.entries.codex.enabled` must be true.
- `plugins.entries.codex.config.codexPlugins.enabled` must be true.
- The target Codex app-server must be able to see the expected marketplace,
  plugin, and app inventory.

`codexPlugins` has no effect on PI runs, normal OpenAI provider runs, ACP
conversation bindings, or other harnesses because those paths do not create
Codex app-server threads with native app config.

## Config

A typical native Codex plugin config looks like this:

```json5
{
  plugins: {
    entries: {
      codex: {
        enabled: true,
        config: {
          codexPlugins: {
            enabled: true,
            allow_destructive_actions: true,
            plugins: {
              "google-calendar": {
                enabled: true,
                marketplaceName: "openai-curated",
                pluginName: "google-calendar",
              },
            },
          },
        },
      },
    },
  },
}
```

After changing `codexPlugins`, new Codex conversations pick up the updated app
set automatically. Use `/new` or `/reset` to refresh the current conversation.
A gateway restart is not required for plugin enable or disable changes.

## Manage plugins from chat

Use `/codex plugins` when you want to inspect or change configured native Codex
plugins from the same chat where you operate the Codex harness:

```text
/codex plugins
/codex plugins list
/codex plugins disable google-calendar
/codex plugins enable google-calendar
```

`/codex plugins` is an alias for `/codex plugins list`. The list output shows
configured plugin keys, on/off state, Codex plugin name, and marketplace from
`plugins.entries.codex.config.codexPlugins.plugins`.

`enable` and `disable` write only to Kova config at `~/.kova/kova.json`. They
do not edit `~/.codex/config.toml` or install new Codex plugins. Only the owner
or a gateway client with the `operator.admin` scope can change plugin state.

Enabling a configured plugin also turns on the global `codexPlugins.enabled`
switch.

## How native plugin setup works

The integration has three separate states:

- Installed: Codex has the local plugin bundle in the target app-server runtime.
- Enabled: Kova config is willing to make the plugin available to Codex harness
  turns.
- Accessible: Codex app-server confirms the plugin's app entries are available
  for the active account and can be mapped to the configured plugin identity.

Thread app config is computed when Kova establishes a Codex harness session or
replaces a stale Codex thread binding. It is not recomputed on every turn, so
`/codex plugins enable` and `/codex plugins disable` affect new Codex
conversations. Use `/new` or `/reset` when the current conversation should pick
up the updated app set.

## Thread app config

Kova injects a restrictive Codex thread app config:

- the default app set is disabled,
- only apps owned by enabled configured plugins are enabled,
- destructive app actions follow the effective global or per-plugin
  `allow_destructive_actions` policy.

Kova lets Codex enforce destructive tool metadata from its native app tool
annotations. Tool approval mode is automatic by default for plugin apps so
non-destructive read tools can run without a same-thread approval UI.

## Destructive action policy

Destructive plugin elicitations are allowed by default for configured Codex
plugins, while unsafe schemas and ambiguous ownership fail closed:

- Global `allow_destructive_actions` defaults to `true`.
- Per-plugin `allow_destructive_actions` overrides the global policy for that
  plugin.
- When policy is `false`, Kova returns a deterministic decline.
- When policy is `true`, Kova auto-accepts only safe schemas it can map to an
  approval response, such as a boolean approve field.
- Missing plugin identity, ambiguous ownership, a missing turn id, a wrong turn
  id, or an unsafe elicitation schema declines instead of prompting.

## Troubleshooting

**The plugin is listed but inactive:** confirm
`plugins.entries.codex.config.codexPlugins.enabled` is true and the individual
plugin entry has `enabled: true`.

**The current chat does not see a newly enabled plugin:** start a new Codex
conversation with `/new` or `/reset`. Existing Codex thread bindings keep the
app config they were created with.

**A destructive action is declined:** check global and per-plugin
`allow_destructive_actions`, then check whether Codex exposed a safe approval
schema. Kova declines unsafe or ambiguous destructive prompts.

**Kova uses PI instead of Codex:** native Codex plugins only apply when the
selected agent uses the Codex harness. See
[Codex harness](/plugins/codex-harness) for runtime selection.

**Plugin calls do not appear as Kova tools:** that is expected. Native Codex
plugin calls live in the Codex thread, not as Kova dynamic tool calls.
