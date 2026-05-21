---
summary: "CLI reference for `kova settings` (terminal settings console)"
read_when:
  - You want to change Kova settings without repeating onboarding
  - You want a keyboard-driven settings console from the terminal
title: "Settings"
---

# `kova settings`

Open the terminal settings console.

```bash
kova settings
```

The settings console is a post-onboarding control surface for common configuration:

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

Each row includes a small status indicator where Kova can resolve one quickly,
for example Gateway running/stopped, workspace existence, memory data, active
plugins, and configured channels.

The bottom runtime bar summarizes the current provider, model, memory mode,
Gateway state, and latest Gateway probe latency.

Keyboard controls:

- Up/Down: move between rows
- Enter: edit the selected row using the existing Kova configuration flow
- Space: toggle supported rows; changes save automatically
- `/`: search rows and jump as you type, for example `/gateway`
- Ctrl+P: open the command palette, then type to filter commands such as
  `Change Provider`, `Toggle Memory`, `Restart Gateway`, or `Open Plugins`
- Q/Esc or the **Finish** row: quit

After an editor finishes, the settings console opens again with refreshed values.

`kova settings` does not remove the full onboarding path. The **Full Setup**
row still opens the complete setup wizard for first-time setup, import, reset,
bootstrap, and advanced setup flows.

For scripts, use targeted non-interactive commands instead:

```bash
kova configure --section model
kova configure --section gateway
kova config set agents.defaults.memorySearch.enabled false
```
