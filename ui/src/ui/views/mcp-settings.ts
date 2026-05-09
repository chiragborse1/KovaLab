import { html, nothing, type TemplateResult } from "lit";

type McpServerRecord = Record<string, unknown>;

export type McpSettingsProps = {
  config: Record<string, unknown> | null;
  disabled: boolean;
  advancedOpen: boolean;
  onAdvancedToggle: (open: boolean) => void;
  onPatch: (path: Array<string | number>, value: unknown) => void;
  renderExactConfig: () => TemplateResult;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getPath(root: Record<string, unknown> | null, path: string[]): unknown {
  let current: unknown = root;
  for (const part of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function boolValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function serverTransport(server: McpServerRecord): "HTTP" | "SSE" | "stdio" | "custom" {
  if (typeof server.url === "string" && server.url.length > 0) {
    return server.transport === "streamable-http" ? "HTTP" : "SSE";
  }
  if (typeof server.command === "string" && server.command.length > 0) {
    return "stdio";
  }
  return "custom";
}

function serverSummary(server: McpServerRecord): string {
  if (typeof server.url === "string" && server.url.length > 0) {
    return server.url;
  }
  if (typeof server.command === "string" && server.command.length > 0) {
    const args = asStringArray(server.args);
    return [server.command, ...args].join(" ");
  }
  return "No command or URL set yet";
}

function includesNeedle(value: unknown, needle: string): boolean {
  if (typeof value === "string") {
    return value.toLowerCase().includes(needle);
  }
  if (Array.isArray(value)) {
    return value.some((item) => includesNeedle(item, needle));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      includesNeedle(item, needle),
    );
  }
  return false;
}

function hasServerLike(servers: Record<string, unknown>, needle: string): boolean {
  return Object.entries(servers).some(
    ([name, server]) => name.toLowerCase().includes(needle) || includesNeedle(server, needle),
  );
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseKeyValueLines(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of value.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function stringifyKeyValue(value: unknown): string {
  const record = asRecord(value);
  return Object.entries(record)
    .map(([key, val]) => `${key}=${String(val)}`)
    .join("\n");
}

function renderStatusPill(label: string, active: boolean) {
  return html`<span class="mcp-pill ${active ? "mcp-pill--ok" : ""}">${label}</span>`;
}

function renderToggleCard(params: {
  title: string;
  detail: string;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return html`
    <label class="mcp-toggle-card">
      <span class="mcp-toggle-card__copy">
        <span class="mcp-toggle-card__title">${params.title}</span>
        <span class="mcp-toggle-card__detail">${params.detail}</span>
      </span>
      <span class="mcp-toggle-card__state">
        ${renderStatusPill(params.enabled ? "ON" : "OFF", params.enabled)}
        <span class="config-simple-toggle__control">
          <input
            type="checkbox"
            .checked=${params.enabled}
            ?disabled=${params.disabled}
            @change=${(event: Event) => params.onChange((event.target as HTMLInputElement).checked)}
          />
          <span></span>
        </span>
      </span>
    </label>
  `;
}

function renderNumberField(params: {
  label: string;
  detail: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return html`
    <label class="mcp-field">
      <span>
        <strong>${params.label}</strong>
        <small>${params.detail}</small>
      </span>
      <input
        type="number"
        min="0"
        .value=${String(params.value)}
        ?disabled=${params.disabled}
        @input=${(event: Event) => {
          const raw = (event.target as HTMLInputElement).value;
          params.onChange(raw === "" ? 0 : Number(raw));
        }}
      />
    </label>
  `;
}

function addServer(props: McpSettingsProps) {
  const id = globalThis.prompt?.("MCP server id, for example github or context7")?.trim();
  if (!id) {
    return;
  }
  props.onPatch(["mcp", "servers", id], { command: "", args: [] });
}

function renderIntegrationCard(params: {
  title: string;
  detail: string;
  configured: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return html`
    <section class="mcp-integration-card">
      <div>
        <div class="mcp-integration-card__top">
          <h4>${params.title}</h4>
          ${renderStatusPill(params.configured ? "Configured" : "Setup", params.configured)}
        </div>
        <p>${params.detail}</p>
      </div>
      <button type="button" @click=${params.onAction}>${params.actionLabel}</button>
    </section>
  `;
}

function renderServerEditor(params: {
  name: string;
  server: McpServerRecord;
  disabled: boolean;
  onPatch: (path: Array<string | number>, value: unknown) => void;
}) {
  const base = ["mcp", "servers", params.name];
  const args = asStringArray(params.server.args).join("\n");
  const env = stringifyKeyValue(params.server.env);
  const headers = stringifyKeyValue(params.server.headers);
  return html`
    <details class="mcp-server-editor">
      <summary>
        <span>
          <strong>${params.name}</strong>
          <small>${serverSummary(params.server)}</small>
        </span>
        ${renderStatusPill(
          serverTransport(params.server),
          serverTransport(params.server) !== "custom",
        )}
      </summary>
      <div class="mcp-server-editor__body">
        <div class="mcp-server-editor__mode">
          <button
            type="button"
            class=${typeof params.server.command === "string" ? "active" : ""}
            ?disabled=${params.disabled}
            @click=${() => {
              params.onPatch([...base, "command"], String(params.server.command ?? ""));
              params.onPatch([...base, "url"], undefined);
            }}
          >
            stdio
          </button>
          <button
            type="button"
            class=${typeof params.server.url === "string" ? "active" : ""}
            ?disabled=${params.disabled}
            @click=${() => {
              params.onPatch([...base, "url"], String(params.server.url ?? ""));
              params.onPatch([...base, "command"], undefined);
            }}
          >
            remote
          </button>
        </div>

        <label class="mcp-field">
          <span>
            <strong>Command</strong>
            <small>Executable for stdio servers, for example npx, uvx, or node.</small>
          </span>
          <input
            .value=${String(params.server.command ?? "")}
            ?disabled=${params.disabled}
            placeholder="npx"
            @input=${(event: Event) =>
              params.onPatch([...base, "command"], (event.target as HTMLInputElement).value)}
          />
        </label>

        <label class="mcp-field mcp-field--stacked">
          <span>
            <strong>Arguments</strong>
            <small>One argument per line. Kova stores this as an args array.</small>
          </span>
          <textarea
            rows="4"
            .value=${args}
            ?disabled=${params.disabled}
            placeholder="-y&#10;@modelcontextprotocol/server-example"
            @input=${(event: Event) =>
              params.onPatch(
                [...base, "args"],
                parseLines((event.target as HTMLTextAreaElement).value),
              )}
          ></textarea>
        </label>

        <label class="mcp-field">
          <span>
            <strong>Remote URL</strong>
            <small>HTTP/SSE endpoint for remote MCP servers.</small>
          </span>
          <input
            .value=${String(params.server.url ?? "")}
            ?disabled=${params.disabled}
            placeholder="http://localhost:3100/mcp"
            @input=${(event: Event) =>
              params.onPatch([...base, "url"], (event.target as HTMLInputElement).value)}
          />
        </label>

        <label class="mcp-field">
          <span>
            <strong>Remote transport</strong>
            <small>Use streamable HTTP when the server supports the newer HTTP transport.</small>
          </span>
          <select
            .value=${String(params.server.transport ?? "sse")}
            ?disabled=${params.disabled}
            @change=${(event: Event) =>
              params.onPatch([...base, "transport"], (event.target as HTMLSelectElement).value)}
          >
            <option value="sse">SSE</option>
            <option value="streamable-http">Streamable HTTP</option>
          </select>
        </label>

        ${renderNumberField({
          label: "Connection timeout",
          detail: "Milliseconds before Kova gives up connecting to this server.",
          value:
            typeof params.server.connectionTimeoutMs === "number"
              ? params.server.connectionTimeoutMs
              : 10_000,
          disabled: params.disabled,
          onChange: (value) => params.onPatch([...base, "connectionTimeoutMs"], value),
        })}

        <label class="mcp-field mcp-field--stacked">
          <span>
            <strong>Environment variables</strong>
            <small>KEY=value per line. Use secret refs or env names, not raw tokens.</small>
          </span>
          <textarea
            rows="4"
            .value=${env}
            ?disabled=${params.disabled}
            placeholder="GITHUB_TOKEN=env:GITHUB_TOKEN"
            @input=${(event: Event) =>
              params.onPatch(
                [...base, "env"],
                parseKeyValueLines((event.target as HTMLTextAreaElement).value),
              )}
          ></textarea>
        </label>

        <label class="mcp-field mcp-field--stacked">
          <span>
            <strong>HTTP headers</strong>
            <small>KEY=value per line for remote servers.</small>
          </span>
          <textarea
            rows="3"
            .value=${headers}
            ?disabled=${params.disabled}
            placeholder="Authorization=Bearer env:TOKEN"
            @input=${(event: Event) =>
              params.onPatch(
                [...base, "headers"],
                parseKeyValueLines((event.target as HTMLTextAreaElement).value),
              )}
          ></textarea>
        </label>

        <div class="mcp-server-editor__footer">
          <button
            type="button"
            class="danger"
            ?disabled=${params.disabled}
            @click=${() => params.onPatch(base, undefined)}
          >
            Remove server
          </button>
        </div>
      </div>
    </details>
  `;
}

export function renderMcpSettings(props: McpSettingsProps) {
  const config = props.config ?? {};
  const mcp = asRecord(config.mcp);
  const servers = asRecord(mcp.servers);
  const serverEntries = Object.entries(servers).toSorted(([left], [right]) =>
    left.localeCompare(right),
  );
  const mcpCommand = boolValue(getPath(config, ["commands", "mcp"]), false);
  const browserEnabled = boolValue(getPath(config, ["browser", "enabled"]), true);
  const workspaceOnly = boolValue(getPath(config, ["tools", "fs", "workspaceOnly"]), true);
  const idleTtl =
    typeof mcp.sessionIdleTtlMs === "number" && Number.isFinite(mcp.sessionIdleTtlMs)
      ? mcp.sessionIdleTtlMs
      : 600_000;
  const idleCleanupEnabled = idleTtl !== 0;
  const hasGithub = hasServerLike(servers, "github");
  const hasFilesystem = hasServerLike(servers, "filesystem") || hasServerLike(servers, "fs");
  const hasBrowser = hasServerLike(servers, "browser") || browserEnabled;

  return html`
    <div class="mcp-settings">
      <section class="mcp-hero">
        <div>
          <p class="mcp-hero__eyebrow">MCP Manager</p>
          <h3>Connect tools without editing raw server objects first.</h3>
          <p>
            Basic controls handle common setup. Advanced keeps the real server fields visible with
            labels, validation shape, and safer editing. The exact config editor stays as the final
            escape hatch.
          </p>
        </div>
        <div class="mcp-hero__stats">
          <strong>${serverEntries.length}</strong>
          <span>configured server${serverEntries.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <section class="mcp-panel">
        <div class="mcp-panel__header">
          <div>
            <h4>Basic</h4>
            <p>Day-to-day MCP switches and integration status.</p>
          </div>
        </div>
        <div class="mcp-toggle-grid">
          ${renderToggleCard({
            title: "Enable /mcp command",
            detail: "Let owner chats inspect and update Kova-managed MCP server definitions.",
            enabled: mcpCommand,
            disabled: props.disabled,
            onChange: (enabled) => props.onPatch(["commands", "mcp"], enabled),
          })}
          ${renderToggleCard({
            title: "Runtime idle cleanup",
            detail: "Close idle MCP sessions automatically after the configured TTL.",
            enabled: idleCleanupEnabled,
            disabled: props.disabled,
            onChange: (enabled) =>
              props.onPatch(["mcp", "sessionIdleTtlMs"], enabled ? 600_000 : 0),
          })}
          ${renderToggleCard({
            title: "Browser access",
            detail: "Allow browser automation tools when a browser runtime is available.",
            enabled: browserEnabled,
            disabled: props.disabled,
            onChange: (enabled) => props.onPatch(["browser", "enabled"], enabled),
          })}
          ${renderToggleCard({
            title: "Filesystem workspace guard",
            detail: "Keep filesystem access constrained to the active workspace.",
            enabled: workspaceOnly,
            disabled: props.disabled,
            onChange: (enabled) => props.onPatch(["tools", "fs", "workspaceOnly"], enabled),
          })}
        </div>
      </section>

      <section class="mcp-panel">
        <div class="mcp-panel__header">
          <div>
            <h4>Integrations</h4>
            <p>Readable setup cards over the same MCP/server config.</p>
          </div>
          <button type="button" ?disabled=${props.disabled} @click=${() => addServer(props)}>
            Add custom server
          </button>
        </div>
        <div class="mcp-integration-grid">
          ${renderIntegrationCard({
            title: "GitHub",
            detail:
              "Expose repository, issue, and PR context through a configured GitHub MCP server.",
            configured: hasGithub,
            actionLabel: hasGithub ? "Review server" : "Add server",
            onAction: () => addServer(props),
          })}
          ${renderIntegrationCard({
            title: "Filesystem",
            detail: "Use workspace-scoped file access instead of broad machine access.",
            configured: hasFilesystem || workspaceOnly,
            actionLabel: "Tune access",
            onAction: () => props.onPatch(["tools", "fs", "workspaceOnly"], true),
          })}
          ${renderIntegrationCard({
            title: "Browser",
            detail: "Browser automation is controlled as a capability, not a raw MCP object.",
            configured: hasBrowser,
            actionLabel: browserEnabled ? "Disable" : "Enable",
            onAction: () => props.onPatch(["browser", "enabled"], !browserEnabled),
          })}
        </div>
      </section>

      <section class="mcp-panel">
        <div class="mcp-panel__header">
          <div>
            <h4>Servers</h4>
            <p>Configured MCP servers with transport and launch details.</p>
          </div>
        </div>
        ${serverEntries.length === 0
          ? html`
              <div class="mcp-empty">
                <strong>No MCP servers configured yet.</strong>
                <span>Add a custom server, then fill command or remote URL in Advanced.</span>
              </div>
            `
          : html`
              <div class="mcp-server-list">
                ${serverEntries.map(([name, value]) =>
                  renderServerEditor({
                    name,
                    server: asRecord(value),
                    disabled: props.disabled,
                    onPatch: props.onPatch,
                  }),
                )}
              </div>
            `}
      </section>

      <section class="mcp-panel">
        <div class="mcp-panel__header">
          <div>
            <h4>Advanced</h4>
            <p>Precise MCP runtime behavior without raw JSON editing.</p>
          </div>
        </div>
        <div class="mcp-advanced-grid">
          ${renderNumberField({
            label: "Idle TTL",
            detail: "Session-scoped MCP idle timeout in milliseconds. Set 0 to disable eviction.",
            value: idleTtl,
            disabled: props.disabled,
            onChange: (value) => props.onPatch(["mcp", "sessionIdleTtlMs"], value),
          })}
        </div>
      </section>

      <details
        class="config-advanced-details"
        ?open=${props.advancedOpen}
        @toggle=${(event: Event) =>
          props.onAdvancedToggle((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>Raw / exact config fallback</summary>
        ${props.advancedOpen
          ? html`<div class="config-advanced-details__body">${props.renderExactConfig()}</div>`
          : nothing}
      </details>
    </div>
  `;
}
