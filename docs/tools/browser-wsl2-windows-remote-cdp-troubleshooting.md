---
summary: "Troubleshoot WSL2 Gateway + Windows Chrome remote CDP in layers"
read_when:
  - Running Kova Gateway in WSL2 while Chrome lives on Windows
  - Deciding between host-local Chrome MCP and raw remote CDP in split-host setups
title: "WSL2 + Windows + remote Chrome CDP troubleshooting"
---

In the common split-host setup, Kova Gateway runs inside WSL2, Chrome runs on Windows, and browser control must cross the WSL2 and Windows boundary. The layered failure pattern from [issue #39369](https://github.com/chiragborse1/KovaLab/issues/39369) means several independent problems can show up at once, which makes the wrong layer look broken first.

## Choose the right browser mode first

You have two valid patterns:

### Option 1: Raw remote CDP from WSL2 to Windows

Use a remote browser profile that points from WSL2 to a Windows Chrome CDP endpoint.

Choose this when:

- the Gateway stays inside WSL2
- Chrome runs on Windows
- you need browser control to cross the WSL2/Windows boundary

### Option 2: Host-local Chrome MCP

Use `existing-session` / `user` only when the Gateway itself runs on the same host as Chrome.

Choose this when:

- Kova and Chrome are on the same machine
- you want the local signed-in browser state
- you do not need cross-host browser transport
- you do not need advanced managed/raw-CDP-only routes like `responsebody`, PDF
  export, download interception, or batch actions

For WSL2 Gateway + Windows Chrome, prefer raw remote CDP. Chrome MCP is host-local, not a WSL2-to-Windows bridge.

## Working architecture

Reference shape:

- WSL2 runs Kova or the Gateway
- Windows Chrome exposes a CDP endpoint on port `9222`
- WSL2 can reach that Windows CDP endpoint
- Kova points a browser profile at the address that is reachable from WSL2

## Why this setup is confusing

Several failures can overlap:

- WSL2 cannot reach the Windows CDP endpoint
- token or pairing is missing
- the browser profile points at the wrong address

Because of that, fixing one layer can still leave a different error visible.

## Validate in layers

Work top to bottom. Do not skip ahead.

### Layer 1: Verify Chrome is serving CDP on Windows

Start Chrome on Windows with remote debugging enabled:

```powershell
chrome.exe --remote-debugging-port=9222
```

From Windows, verify Chrome itself first:

```powershell
curl http://127.0.0.1:9222/json/version
curl http://127.0.0.1:9222/json/list
```

If this fails on Windows, Kova is not the problem yet.

### Layer 2: Verify WSL2 can reach that Windows endpoint

From WSL2, test the exact address you plan to use in `cdpUrl`:

```bash
curl http://WINDOWS_HOST_OR_IP:9222/json/version
curl http://WINDOWS_HOST_OR_IP:9222/json/list
```

Good result:

- `/json/version` returns JSON with Browser / Protocol-Version metadata
- `/json/list` returns JSON (empty array is fine if no pages are open)

If this fails:

- Windows is not exposing the port to WSL2 yet
- the address is wrong for the WSL2 side
- firewall / port forwarding / local proxying is still missing

Fix that before touching Kova config.

### Layer 3: Configure the correct browser profile

For raw remote CDP, point Kova at the address that is reachable from WSL2:

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "remote",
    profiles: {
      remote: {
        cdpUrl: "http://WINDOWS_HOST_OR_IP:9222",
        attachOnly: true,
        color: "#00AA00",
      },
    },
  },
}
```

Notes:

- use the WSL2-reachable address, not whatever only works on Windows
- keep `attachOnly: true` for externally managed browsers
- `cdpUrl` can be `http://`, `https://`, `ws://`, or `wss://`
- use HTTP(S) when you want Kova to discover `/json/version`
- use WS(S) only when the browser provider gives you a direct DevTools socket URL
- test the same URL with `curl` before expecting Kova to succeed

### Layer 4: Verify end-to-end browser control

From WSL2:

```bash
kova browser open https://example.com --browser-profile remote
kova browser tabs --browser-profile remote
```

Good result:

- the tab opens in Windows Chrome
- `kova browser tabs` returns the target
- later actions (`snapshot`, `screenshot`, `navigate`) work from the same profile

## Common misleading errors

Treat each message as a layer-specific clue:

- `token_missing`
  - auth configuration problem
- `pairing required`
  - device approval problem
- `Remote CDP for profile "remote" is not reachable`
  - WSL2 cannot reach the configured `cdpUrl`
- `Browser attachOnly is enabled and CDP websocket for profile "remote" is not reachable`
  - the HTTP endpoint answered, but the DevTools WebSocket still could not be opened
- stale viewport / dark-mode / locale / offline overrides after a remote session
  - run `kova browser stop --browser-profile remote`
  - this closes the active control session and releases Playwright/CDP emulation state without restarting the gateway or the external browser
- `gateway timeout after 1500ms`
  - often still CDP reachability or a slow/unreachable remote endpoint
- `No Chrome tabs found for profile="user"`
  - local Chrome MCP profile selected where no host-local tabs are available

## Fast triage checklist

1. Windows: does `curl http://127.0.0.1:9222/json/version` work?
2. WSL2: does `curl http://WINDOWS_HOST_OR_IP:9222/json/version` work?
3. Kova config: does `browser.profiles.<name>.cdpUrl` use that exact WSL2-reachable address?
4. Are you trying to use `existing-session` across WSL2 and Windows instead of raw remote CDP?

## Practical takeaway

The setup is usually viable. The hard part is that browser transport and
token/pairing can each fail independently while looking similar from the user
side.

When in doubt:

- verify the Windows Chrome endpoint locally first
- verify the same endpoint from WSL2 second
- only then debug Kova config or Gateway auth

## Related

- [Browser](/tools/browser)
- [Browser login](/tools/browser-login)
- [Browser Linux troubleshooting](/tools/browser-linux-troubleshooting)
