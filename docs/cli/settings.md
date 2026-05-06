---
summary: "CLI reference for `kova settings` (dashboard-style configuration)"
read_when:
  - You want to change Kova settings without repeating onboarding
  - You want a keyboard-driven settings dashboard from the terminal
title: "Settings"
---

# `kova settings`

Open the Kova settings dashboard.

```bash
kova settings
```

The dashboard is a post-onboarding control surface for common configuration:

- Provider and model
- Workspace
- Gateway access
- Channels
- Memory
- Browser tools
- Voice
- Web search
- Skills and plugins
- Background service
- Health check

Keyboard controls:

- Up/Down: move between rows
- Enter: edit the selected row using the existing Kova configuration flow
- Space: toggle supported rows
- S: save pending toggles
- Q/Esc or the **Finish** row: quit

After an editor finishes, the dashboard opens again with refreshed values.

`kova settings` does not remove the full onboarding path. The **Full Setup**
row still opens the complete setup wizard for first-time setup, import, reset,
bootstrap, and advanced setup flows.

For scripts, use targeted non-interactive commands instead:

```bash
kova configure --section model
kova configure --section gateway
kova config set agents.defaults.memorySearch.enabled false
```
