---
summary: "Manage sandbox runtimes and inspect effective sandbox policy"
title: Sandbox CLI
read_when: "You are managing sandbox runtimes or debugging sandbox/tool-policy behavior."
status: active
---

Manage sandbox runtimes for isolated agent execution.

## Overview

Kova can run agents in isolated sandbox runtimes for security. The `sandbox` commands help you inspect and recreate those runtimes after updates or configuration changes.

Today that usually means:

- Docker sandbox containers
- SSH sandbox runtimes when `agents.defaults.sandbox.backend = "ssh"`
- OpenShell sandbox runtimes when `agents.defaults.sandbox.backend = "openshell"`

For `ssh` and OpenShell `remote`, recreate matters more than with Docker:

- the remote workspace is canonical after the initial seed
- `kova sandbox recreate` deletes that canonical remote workspace for the selected scope
- next use seeds it again from the current local workspace

## Commands

### `kova sandbox explain`

Inspect the **effective** sandbox mode/scope/workspace access, sandbox tool policy, and elevated gates (with fix-it config key paths).

```bash
kova sandbox explain
kova sandbox explain --session agent:main:main
kova sandbox explain --agent work
kova sandbox explain --json
```

### `kova sandbox list`

List all sandbox runtimes with their status and configuration.

```bash
kova sandbox list
kova sandbox list --browser  # List only browser containers
kova sandbox list --json     # JSON output
```

**Output includes:**

- Runtime name and status
- Backend (`docker`, `openshell`, etc.)
- Config label and whether it matches current config
- Age (time since creation)
- Idle time (time since last use)
- Associated session/agent

### `kova sandbox recreate`

Remove sandbox runtimes to force recreation with updated config.

```bash
kova sandbox recreate --all                # Recreate all containers
kova sandbox recreate --session main       # Specific session
kova sandbox recreate --agent mybot        # Specific agent
kova sandbox recreate --browser            # Only browser containers
kova sandbox recreate --all --force        # Skip confirmation
```

**Options:**

- `--all`: Recreate all sandbox containers
- `--session <key>`: Recreate container for specific session
- `--agent <id>`: Recreate containers for specific agent
- `--browser`: Only recreate browser containers
- `--force`: Skip confirmation prompt

<Note>
Runtimes are automatically recreated when the agent is next used.
</Note>

## Use cases

### After updating a Docker image

```bash
# Pull new image
docker pull kova-sandbox:latest
docker tag kova-sandbox:latest kova-sandbox:bookworm-slim

# Update config to use new image
# Edit config: agents.defaults.sandbox.docker.image (or agents.list[].sandbox.docker.image)

# Recreate containers
kova sandbox recreate --all
```

### After changing sandbox configuration

```bash
# Edit config: agents.defaults.sandbox.* (or agents.list[].sandbox.*)

# Recreate to apply new config
kova sandbox recreate --all
```

### After changing SSH target or SSH auth material

```bash
# Edit config:
# - agents.defaults.sandbox.backend
# - agents.defaults.sandbox.ssh.target
# - agents.defaults.sandbox.ssh.workspaceRoot
# - agents.defaults.sandbox.ssh.identityFile / certificateFile / knownHostsFile
# - agents.defaults.sandbox.ssh.identityData / certificateData / knownHostsData

kova sandbox recreate --all
```

For the core `ssh` backend, recreate deletes the per-scope remote workspace root
on the SSH target. The next run seeds it again from the local workspace.

### After changing OpenShell source, policy, or mode

```bash
# Edit config:
# - agents.defaults.sandbox.backend
# - plugins.entries.openshell.config.from
# - plugins.entries.openshell.config.mode
# - plugins.entries.openshell.config.policy

kova sandbox recreate --all
```

For OpenShell `remote` mode, recreate deletes the canonical remote workspace
for that scope. The next run seeds it again from the local workspace.

### After changing setupCommand

```bash
kova sandbox recreate --all
# or just one agent:
kova sandbox recreate --agent family
```

### For a specific agent only

```bash
# Update only one agent's containers
kova sandbox recreate --agent alfred
```

## Why this is needed

When you update sandbox configuration:

- Existing runtimes continue running with old settings.
- Runtimes are only pruned after 24h of inactivity.
- Regularly-used agents keep old runtimes alive indefinitely.

Use `kova sandbox recreate` to force removal of old runtimes. They are recreated automatically with current settings when next needed.

<Tip>
Prefer `kova sandbox recreate` over manual backend-specific cleanup. It uses the Gateway's runtime registry and avoids mismatches when scope or session keys change.
</Tip>

## Configuration

Sandbox settings live in `~/.kova/kova.json` under `agents.defaults.sandbox` (per-agent overrides go in `agents.list[].sandbox`):

```jsonc
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "all", // off, non-main, all
        "backend": "docker", // docker, ssh, openshell
        "scope": "agent", // session, agent, shared
        "docker": {
          "image": "kova-sandbox:bookworm-slim",
          "containerPrefix": "kova-sbx-",
          // ... more Docker options
        },
        "prune": {
          "idleHours": 24, // Auto-prune after 24h idle
          "maxAgeDays": 7, // Auto-prune after 7 days
        },
      },
    },
  },
}
```

## Related

- [CLI reference](/cli)
- [Sandboxing](/gateway/sandboxing)
- [Agent workspace](/concepts/agent-workspace)
- [Doctor](/gateway/doctor): checks sandbox setup.
