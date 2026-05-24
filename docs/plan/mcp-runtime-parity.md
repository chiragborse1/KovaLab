---
title: "MCP Runtime Parity"
summary: "Decision plan for saved-server status, dynamic tool refresh, sampling, and MCP surface boundaries"
read_when:
  - You are comparing Kova MCP support with another agent platform
  - You are adding MCP client/runtime behavior
  - You are changing bundle MCP, saved MCP config, or `kova mcp serve`
---

## Current Position

Kova has three MCP surfaces:

| Surface             | What it means                                                     | Status        |
| ------------------- | ----------------------------------------------------------------- | ------------- |
| `kova mcp serve`    | Kova acts as an MCP server for channel conversations              | Strong        |
| Saved `mcp.servers` | Kova stores outbound MCP server definitions for runtime adapters  | Config status |
| Bundle MCP          | Compatible plugin bundles contribute MCP servers to embedded runs | Supported     |

Do not merge these into one mental model. They share the MCP protocol, but they
have different owners and lifecycles.

## Decisions

### Saved-server status

Added first.

`kova mcp list/status/show/set/unset` currently manage config only. They do not
connect to saved servers and should not pretend to be a runtime health check.

Planned shape:

```bash
kova mcp status
kova mcp status <name>
kova mcp status --json
```

The status command should:

- load saved `mcp.servers`
- classify transport (`stdio`, `sse`, `streamable-http`)
- report config validity without launching expensive servers by default
- redact env, headers, URLs, and auth material
- show whether an active runtime adapter is expected to consume that server

Still planned after the config-status surface:

- optionally probe reachability with `--probe`

### Dynamic tool refresh

Support dynamic tool refresh after saved-server status exists.

MCP servers may announce tool-list changes. Kova should refresh tools when the
runtime owns a long-lived MCP client and receives a tool-list-changed signal.
The refresh should be:

- session-scoped
- debounced
- deterministic before provider/tool payloads are rebuilt
- visible in trace/debug logs
- safe when the server flaps or returns a malformed tool list

Do not add polling loops before signal-driven refresh is wired.

### Sampling

Do not enable MCP sampling by default.

Sampling lets an MCP server ask the host model to generate text. That is a
different trust boundary from "server provides tools." Kova should only add it
when there is a concrete Kova-owned use case and an explicit policy gate.

If added later, sampling must require:

- explicit config enablement per server
- model/provider allowlist
- prompt and response size limits
- audit/trace visibility
- no access to channel secrets unless intentionally delegated

## Implementation Order

1. Document the current surface split in CLI docs.
2. Add `kova mcp status` as a config-validity command. Done.
3. Add optional `--probe` reachability checks with strict timeouts.
4. Surface MCP status in `kova status --all` after the command is stable. Done.
5. Add dynamic `tools/list_changed` refresh for long-lived runtime clients.
6. Revisit sampling only with a real product use case.

## Non Goals

- No hidden background probes during plain `kova mcp list`.
- No provider/tool payload reorder from nondeterministic MCP discovery.
- No blanket sampling support.
- No conflating `kova mcp serve` with outbound saved-server config.

## Related

- [MCP CLI](/cli/mcp)
- [Plugin bundles](/plugins/bundles)
- [ACP agents setup](/tools/acp-agents-setup)
