---
summary: "Gateway remote access without a browser surface"
read_when:
  - You want to access the Gateway over Tailscale
  - You are choosing a safe bind mode for remote Kova access
title: "Remote Access"
---

Kova is terminal-first. Use `kova`, `kova status`, `kova settings`, and
`kova logs` for normal operation.

The Gateway HTTP server remains useful for WebSockets, health checks, webhooks,
plugin endpoints, channel callbacks, nodes, and remote CLI/TUI clients. It no
longer serves a bundled browser surface.

## Webhooks

When `hooks.enabled=true`, the Gateway exposes a small webhook endpoint on the
same HTTP server. See [Gateway configuration](/gateway/configuration) for auth
and payload settings.

## Tailscale access

### Integrated Serve

Keep the Gateway on loopback and let Tailscale Serve proxy it:

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

Then start the gateway:

```bash
kova gateway
```

Connect from another machine with the CLI/TUI using the served URL and Gateway
credentials.

### Tailnet bind + token

```json5
{
  gateway: {
    bind: "tailnet",
    auth: { mode: "token", token: "your-token" },
  },
}
```

Then start the gateway:

```bash
kova gateway
```

Use `kova gateway status --deep` to inspect the resolved bind, auth, and remote
connection hints.

### Public internet

Avoid exposing the Gateway directly to the public internet. If you must put it
behind a public reverse proxy, use TLS, strong Gateway auth, and explicit trusted
proxy configuration. Keep channel webhook paths separate from operator access.

## Security notes

- Gateway auth is required by default.
- Non-loopback binds still require token, password, Tailscale identity, or an
  identity-aware reverse proxy with `gateway.auth.mode: "trusted-proxy"`.
- The wizard creates shared-secret auth by default and usually generates a
  Gateway token.
- When `gateway.tls.enabled: true`, status helpers render `https://` and `wss://`
  connection hints.
- `gateway.tailscale.mode: "funnel"` requires `gateway.auth.mode: "password"`.
- Run `kova security audit --deep` after changing bind, TLS, proxy, or channel
  webhook settings.
