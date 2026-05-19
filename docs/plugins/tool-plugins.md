---
summary: "Build simple typed agent tools with defineToolPlugin and kova plugins init/build/validate"
title: "Tool plugins"
sidebarTitle: "Tool Plugins"
read_when:
  - You want to build a simple Kova plugin that only adds agent tools
  - You want to use defineToolPlugin instead of hand-writing plugin manifest metadata
  - You need to scaffold, generate, validate, test, or publish a tool-only plugin
---

Tool plugins add agent-callable tools to Kova without adding a channel, model
provider, hook, service, or setup backend. Use `defineToolPlugin` when the
plugin owns a fixed list of tools and you want Kova to generate the manifest
metadata that keeps those tools discoverable without loading runtime code.

The recommended flow is:

1. Scaffold a package with `kova plugins init`.
2. Write tools with `defineToolPlugin`.
3. Build JavaScript.
4. Generate `kova.plugin.json` and `package.json` metadata with `kova plugins build`.
5. Validate the generated metadata before publishing or installing.

For provider, channel, hook, service, or mixed-capability plugins, start with
[Building plugins](/plugins/building-plugins), [Channel Plugins](/plugins/sdk-channel-plugins),
or [Provider Plugins](/plugins/sdk-provider-plugins) instead.

## Requirements

- Node >= 22.
- TypeScript ESM package output.
- `typebox` for config and tool parameter schemas.
- `getkova >=2.0.0-beta.5`, which exports `getkova/plugin-sdk/tool-plugin`.
- A package root that can ship `dist/`, `kova.plugin.json`, and `package.json`.

The generated plugin imports `typebox` at runtime, so keep `typebox` in
`dependencies`, not only `devDependencies`.

## Quickstart

Create a new plugin package:

```bash
kova plugins init stock-quotes --name "Stock Quotes"
cd stock-quotes
npm install
npm run plugin:build
npm run plugin:validate
npm test
```

The scaffold creates:

- `src/index.ts`: a `defineToolPlugin` entry with an `echo` tool.
- `src/index.test.ts`: a small metadata test.
- `tsconfig.json`: NodeNext TypeScript output to `dist/`.
- `package.json`: scripts, runtime dependencies, and `kova.extensions: ["./dist/index.js"]`.
- `kova.plugin.json`: generated manifest metadata for the initial tool.

Expected validation output:

```text
Plugin stock-quotes is valid.
```

## Write a tool

`defineToolPlugin` takes plugin identity, an optional config schema, and a
static list of tools. Parameter and config types are inferred from TypeBox
schemas.

```typescript
import { Type } from "typebox";
import { defineToolPlugin } from "getkova/plugin-sdk/tool-plugin";

export default defineToolPlugin({
  id: "stock-quotes",
  name: "Stock Quotes",
  description: "Fetch stock quote snapshots.",
  configSchema: Type.Object({
    apiKey: Type.Optional(Type.String({ description: "Quote API key." })),
    baseUrl: Type.Optional(Type.String({ description: "Quote API base URL." })),
  }),
  tools: (tool) => [
    tool({
      name: "stock_quote",
      label: "Stock Quote",
      description: "Fetch a stock quote snapshot.",
      parameters: Type.Object({
        symbol: Type.String({ description: "Ticker symbol, for example OPEN." }),
      }),
      async execute({ symbol }, config, context) {
        context.signal?.throwIfAborted();
        return {
          symbol: symbol.toUpperCase(),
          configured: Boolean(config.apiKey),
          baseUrl: config.baseUrl ?? "https://api.example.com",
        };
      },
    }),
  ],
});
```

Tool names are the stable API. Pick names that are unique, lowercase, and
specific enough to avoid collisions with core tools or other plugins.

## Optional and factory tools

Set `optional: true` when users should explicitly allowlist the tool before it
is sent to a model:

```typescript
tool({
  name: "workflow_run",
  description: "Run an external workflow.",
  parameters: Type.Object({ goal: Type.String() }),
  optional: true,
  execute: ({ goal }) => ({ queued: true, goal }),
});
```

`kova plugins build` writes the matching `toolMetadata.<tool>.optional`
manifest entry, so Kova can discover the tool without loading plugin runtime
code.

Use `factory` when a tool needs the runtime tool context before it can be
created. The factory keeps metadata static while letting the tool opt out for a
specific run, inspect sandbox state, or bind runtime helpers.

```typescript
tool({
  name: "local_workflow",
  description: "Run a local workflow outside sandboxed sessions.",
  parameters: Type.Object({ goal: Type.String() }),
  optional: true,
  factory({ api, toolContext }) {
    if (toolContext.sandboxed) {
      return null;
    }
    return createLocalWorkflowTool(api);
  },
});
```

Provider-backed tool factories can also check trusted auth availability through
`toolContext.hasAuthForProvider("provider-id")` and resolve the active key or
token with `toolContext.resolveApiKeyForProvider("provider-id")`. These helpers
respect Kova auth-profile order, eligibility, and SecretRef resolution for the
current run.

Factories are still for fixed tool names. Use `definePluginEntry` directly when
the plugin computes tool names dynamically or combines tools with hooks,
services, providers, commands, or other runtime surfaces.

## Generated metadata

Kova discovers installed plugins from cold metadata. It must be able to read
the plugin manifest before importing plugin runtime code. `defineToolPlugin`
therefore exposes static metadata, and `kova plugins build` writes that
metadata into the package.

Run the generator after changing plugin id, name, description, config schema,
activation, or tool names:

```bash
npm run build
kova plugins build --entry ./dist/index.js
```

For a one-tool plugin, the generated manifest looks like this:

```json
{
  "id": "stock-quotes",
  "name": "Stock Quotes",
  "description": "Fetch stock quote snapshots.",
  "version": "0.1.0",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  },
  "activation": {
    "onCapabilities": ["tool"]
  },
  "contracts": {
    "tools": ["stock_quote"]
  }
}
```

`contracts.tools` is the important discovery contract. It tells Kova which
plugin owns each tool without loading every installed plugin runtime.

## Validate in CI

Use `plugins build --check` to fail CI when generated metadata is stale without
rewriting files:

```bash
npm run build
kova plugins build --entry ./dist/index.js --check
kova plugins validate --entry ./dist/index.js
npm test
```

`plugins validate` checks that:

- `kova.plugin.json` exists and passes the normal manifest loader.
- The current entry exports `defineToolPlugin` metadata.
- Generated manifest fields match the entry metadata.
- `contracts.tools` matches the declared tool names.
- `package.json` points `kova.extensions` at the selected runtime entry.

## Publish

Publish through KovaHub when the package is ready:

```bash
kovahub package publish your-org/stock-quotes --dry-run
kovahub package publish your-org/stock-quotes
```

Install with an explicit KovaHub locator:

```bash
kova plugins install kovahub:your-org/stock-quotes
```

## Troubleshooting

### `plugin entry not found: ./dist/index.js`

The selected entry file does not exist. Run `npm run build`, then rerun
`kova plugins build --entry ./dist/index.js` or
`kova plugins validate --entry ./dist/index.js`.

### `plugin entry does not expose defineToolPlugin metadata`

The entry did not export a value created by `defineToolPlugin`. Check that the
module default export is the `defineToolPlugin(...)` result, or pass the correct
entry with `--entry`.

### `kova.plugin.json generated metadata is stale`

The manifest no longer matches the entry metadata. Run:

```bash
npm run build
kova plugins build --entry ./dist/index.js
```

Commit both `kova.plugin.json` and `package.json` changes.

### `package.json kova.extensions must include ./dist/index.js`

The package metadata points at a different runtime entry. Run
`kova plugins build --entry ./dist/index.js` so the generator aligns the package
metadata with the entry you intend to ship.

## See also

- [Building plugins](/plugins/building-plugins)
- [Plugin entry points](/plugins/sdk-entrypoints)
- [Plugin SDK subpaths](/plugins/sdk-subpaths)
- [Plugin manifest](/plugins/manifest)
- [Plugins CLI](/cli/plugins)
- [KovaHub](/tools/kovahub)
