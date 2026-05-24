---
summary: "Get Kova installed and run your first chat in minutes."
read_when:
  - First time setup from zero
  - You want the fastest path to a working chat
title: "Getting started"
---

Install Kova, run onboarding, and start a terminal chat in about 5 minutes.
By the end you will have a local agent workspace, configured model auth, and a
working `kova chat` session. The Gateway, channels, apps, and Control UI can be
enabled separately after the local agent is working.

## What you need

- **Node.js** — Node 24 recommended (Node 22.14+ also supported)
- **An API key** from a model provider (Anthropic, OpenAI, Google, etc.) — onboarding will prompt you

<Tip>
Check your Node version with `node --version`.
**Windows users:** both native Windows and WSL2 are supported. WSL2 is more
stable and recommended for the full experience. See [Windows](/platforms/windows).
Need to install Node? See [Node setup](/install/node).
</Tip>

## Quick setup

<Steps>
  <Step title="Install Kova">
    <Tabs>
      <Tab title="macOS / Linux">
        ```bash
        curl -fsSL https://www.neuralstudio.in/install.sh | bash
        ```
        <img
  src="/assets/install-script.svg"
  alt="Install Script Process"
  className="rounded-lg"
/>
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://www.neuralstudio.in/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    Other install methods (Docker, Nix, npm): [Install](/install).
    </Note>

  </Step>
  <Step title="Run onboarding">
    ```bash
    kova onboard --install-daemon
    ```

    The wizard walks you through choosing a model provider, setting auth,
    creating the workspace, enabling the learning loop, and opening terminal
    chat. It takes about 2 minutes.

    See [Onboarding (CLI)](/start/wizard) for the full reference.

  </Step>
  <Step title="Start terminal chat">
    ```bash
    kova chat
    ```

    This runs the embedded local agent directly. No browser, Gateway, or chat
    channel is required for the first conversation.

  </Step>
  <Step title="Optional: verify the Gateway">
    ```bash
    kova gateway status
    ```

    The Gateway is headless infrastructure for remote access, channels, cron,
    nodes, apps, and optional web compatibility. If you installed the daemon,
    you should see it listening on port 18789.

  </Step>
  <Step title="Optional: inspect from the terminal">
    ```bash
    kova status --all
    kova settings
    kova logs
    ```

    These commands are the normal operator surface for health, settings,
    channels, memory, plugins, skills, and logs.

    Want to chat from your phone instead? The fastest channel to set up is
    [Telegram](/channels/telegram) (just a bot token). See [Channels](/channels)
    for all options.

  </Step>
</Steps>

<Accordion title="Legacy: enable the browser Control UI">
  Kova's primary flow is terminal-first. If you still need the legacy browser
  Control UI, enable it explicitly and point `gateway.controlUi.root` to built
  static assets when you use a custom build.

```bash
mkdir -p "$HOME/.kova/control-ui-custom"
# Copy your built static files into that directory.
```

Then set:

```json
{
  "gateway": {
    "controlUi": {
      "enabled": true,
      "root": "$HOME/.kova/control-ui-custom"
    }
  }
}
```

Restart the Gateway and reopen the Control UI:

```bash
kova gateway restart
kova control-ui
```

</Accordion>

## What to do next

<Columns>
  <Card title="Connect a channel" href="/channels" icon="message-square">
    Discord, Feishu, iMessage, Matrix, Microsoft Teams, Signal, Slack, Telegram, WhatsApp, Zalo, and more.
  </Card>
  <Card title="Pairing and safety" href="/channels/pairing" icon="shield">
    Control who can message your agent.
  </Card>
  <Card title="Configure the Gateway" href="/gateway/configuration" icon="settings">
    Models, tools, sandbox, and advanced settings.
  </Card>
  <Card title="Browse tools" href="/tools" icon="wrench">
    Browser, exec, web search, skills, and plugins.
  </Card>
</Columns>

<Accordion title="Advanced: environment variables">
  If you run Kova as a service account or want custom paths:

- `KOVA_HOME` — home directory for internal path resolution
- `KOVA_STATE_DIR` — override the state directory
- `KOVA_CONFIG_PATH` — override the config file path

Full reference: [Environment variables](/help/environment).
</Accordion>

## Related

- [Install overview](/install)
- [Channels overview](/channels)
- [Setup](/start/setup)
