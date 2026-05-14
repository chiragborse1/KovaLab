import { html, nothing } from "lit";
import {
  resolvePendingDeviceApprovalState,
  type DevicePairingAccessSummary,
  type PendingDeviceApprovalKind,
} from "../../../../src/shared/device-pairing-access.js";
import { t } from "../../i18n/index.ts";
import type { DeviceTokenSummary, PairedDevice, PendingDevice } from "../controllers/devices.ts";
import { formatRelativeTimestamp, formatList } from "../format.ts";
import { normalizeOptionalString } from "../string-coerce.ts";
import { renderExecApprovals, resolveExecApprovalsState } from "./nodes-exec-approvals.ts";
import { resolveConfigAgents, resolveNodeTargets, type NodeTargetOption } from "./nodes-shared.ts";
export type { NodesProps } from "./nodes.types.ts";
import type { NodesProps } from "./nodes.types.ts";

type NodeStatus = "connected" | "offline";

type NodeView = {
  id: string;
  title: string;
  platform: string;
  version: string | null;
  remoteIp: string | null;
  deviceFamily: string | null;
  modelIdentifier: string | null;
  paired: boolean;
  connected: boolean;
  status: NodeStatus;
  connectedAtMs: number | null;
  approvedAtMs: number | null;
  caps: string[];
  commands: string[];
  permissions: Array<[string, boolean]>;
  execCapable: boolean;
  browserCapable: boolean;
  mediaCapable: boolean;
};

type NodeFleetView = {
  nodes: NodeView[];
  connected: number;
  offline: number;
  execCapable: number;
  browserCapable: number;
  pendingDevices: number;
  activeTokens: number;
  totalCapabilities: number;
};

export function renderNodes(props: NodesProps) {
  const bindingState = resolveBindingsState(props);
  const approvalsState = resolveExecApprovalsState(props);
  const fleet = resolveNodeFleet(props);
  return html`
    <div class="nodes-console">
      ${renderNodeCommandCenter(fleet, props)}
      <div class="nodes-workspace">
        <div class="nodes-main-column">
          ${renderNodeFleet(fleet, props)} ${renderDevices(props, fleet)}
        </div>
        <div class="nodes-side-column">
          ${renderNodeSetupGuide(fleet)} ${renderBindings(bindingState)}
          ${renderExecApprovals(approvalsState)}
        </div>
      </div>
    </div>
  `;
}

function resolveNodeFleet(props: NodesProps): NodeFleetView {
  const nodes = props.nodes.map(resolveNodeView);
  const pending = props.devicesList?.pending ?? [];
  const pairedDevices = props.devicesList?.paired ?? [];
  const activeTokens = pairedDevices.reduce((count, device) => {
    const tokens = Array.isArray(device.tokens) ? device.tokens : [];
    return count + tokens.filter((token) => !token.revokedAtMs).length;
  }, 0);
  const capabilitySet = new Set<string>();
  nodes.forEach((node) => {
    node.caps.forEach((cap) => capabilitySet.add(cap));
    node.commands.forEach((command) => capabilitySet.add(command));
  });
  return {
    nodes,
    connected: nodes.filter((node) => node.connected).length,
    offline: nodes.filter((node) => !node.connected).length,
    execCapable: nodes.filter((node) => node.execCapable).length,
    browserCapable: nodes.filter((node) => node.browserCapable).length,
    pendingDevices: pending.length,
    activeTokens,
    totalCapabilities: capabilitySet.size,
  };
}

function resolveNodeView(node: Record<string, unknown>): NodeView {
  const id = normalizeOptionalString(node.nodeId) ?? "unknown";
  const displayName = normalizeOptionalString(node.displayName);
  const caps = normalizeStringList(node.caps);
  const commands = normalizeStringList(node.commands);
  const connected = Boolean(node.connected);
  return {
    id,
    title: displayName ?? id,
    platform: normalizeOptionalString(node.platform) ?? "unknown platform",
    version:
      normalizeOptionalString(node.version) ??
      normalizeOptionalString(node.coreVersion) ??
      normalizeOptionalString(node.uiVersion),
    remoteIp: normalizeOptionalString(node.remoteIp),
    deviceFamily: normalizeOptionalString(node.deviceFamily),
    modelIdentifier: normalizeOptionalString(node.modelIdentifier),
    paired: Boolean(node.paired),
    connected,
    status: connected ? "connected" : "offline",
    connectedAtMs: normalizeOptionalNumber(node.connectedAtMs),
    approvedAtMs: normalizeOptionalNumber(node.approvedAtMs),
    caps,
    commands,
    permissions: normalizeBooleanEntries(node.permissions),
    execCapable: commands.includes("system.run"),
    browserCapable: commands.some((command) => command.startsWith("browser.")),
    mediaCapable: commands.some(
      (command) =>
        command.startsWith("camera.") ||
        command.startsWith("screen.") ||
        command.startsWith("canvas.") ||
        command.startsWith("location."),
    ),
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean)
    .toSorted((left, right) => left.localeCompare(right));
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeBooleanEntries(value: unknown): Array<[string, boolean]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    .toSorted(([left], [right]) => left.localeCompare(right));
}

function renderNodeCommandCenter(fleet: NodeFleetView, props: NodesProps) {
  return html`
    <section class="card nodes-command-center">
      <div class="nodes-command-center__head">
        <div>
          <div class="card-title">Node fleet</div>
          <div class="card-sub">
            Remote hosts, paired devices, and execution targets available to Kova.
          </div>
        </div>
        <div class="nodes-command-center__actions">
          <button class="btn" ?disabled=${props.devicesLoading} @click=${props.onDevicesRefresh}>
            ${props.devicesLoading ? t("common.loading") : "Refresh devices"}
          </button>
          <button class="btn primary" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? t("common.loading") : "Refresh nodes"}
          </button>
        </div>
      </div>
      <div class="nodes-metric-grid">
        ${renderFleetMetric("Connected", String(fleet.connected), "Live node hosts", "ok")}
        ${renderFleetMetric("Offline", String(fleet.offline), "Paired but not connected")}
        ${renderFleetMetric(
          "Pending",
          String(fleet.pendingDevices),
          "Pairing requests",
          fleet.pendingDevices ? "warn" : "muted",
        )}
        ${renderFleetMetric("Exec", String(fleet.execCapable), "system.run capable")}
        ${renderFleetMetric("Caps", String(fleet.totalCapabilities), "Unique commands + caps")}
      </div>
    </section>
  `;
}

function renderFleetMetric(
  label: string,
  value: string,
  note: string,
  tone: "ok" | "warn" | "muted" | null = null,
) {
  return html`
    <div class="nodes-metric ${tone ? `is-${tone}` : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </div>
  `;
}

function renderNodeFleet(fleet: NodeFleetView, props: NodesProps) {
  return html`
    <section class="card nodes-fleet">
      <div class="nodes-section-head">
        <div>
          <div class="card-title">Live topology</div>
          <div class="card-sub">
            ${fleet.nodes.length} known node${fleet.nodes.length === 1 ? "" : "s"} ·
            ${fleet.execCapable} can run approved shell commands · ${fleet.browserCapable} expose
            browser automation.
          </div>
        </div>
        <span class="nodes-status-badge ${props.loading ? "is-warn" : "is-ok"}">
          ${props.loading ? "syncing" : "current"}
        </span>
      </div>
      <div class="nodes-fleet-list">
        ${fleet.nodes.length === 0
          ? renderNoNodesEmptyState()
          : fleet.nodes.map((node) => renderNode(node))}
      </div>
    </section>
  `;
}

function renderNoNodesEmptyState() {
  return html`
    <div class="nodes-empty">
      <strong>No nodes found</strong>
      <span>
        Add a headless host when you want Kova to run approved commands, browser automation, or
        media actions on another machine.
      </span>
      <code>kova node run --host 127.0.0.1 --port 18789</code>
    </div>
  `;
}

function renderNode(node: NodeView) {
  const commandPreview = node.commands.length
    ? `${node.commands.length} command${node.commands.length === 1 ? "" : "s"}`
    : "no commands";
  const capsPreview = node.caps.length
    ? `${node.caps.length} cap${node.caps.length === 1 ? "" : "s"}`
    : "no caps";
  const connectedWhen = node.connectedAtMs
    ? formatRelativeTimestamp(node.connectedAtMs)
    : node.connected
      ? "connected"
      : "not connected";
  return html`
    <details
      class="nodes-row ${node.connected ? "is-connected" : "is-offline"}"
      ?open=${node.connected}
    >
      <summary>
        <span class="nodes-dot nodes-dot--${node.status}"></span>
        <span class="nodes-row__main">
          <span class="nodes-row__title">${node.title}</span>
          <span class="nodes-row__sub">
            <span class="mono">${node.id}</span>
            ${node.remoteIp ? html`<span>${node.remoteIp}</span>` : nothing}
            <span>${node.platform}</span>
          </span>
        </span>
        <span class="nodes-row__meta">
          <span>${commandPreview}</span>
          <span>${connectedWhen}</span>
        </span>
      </summary>
      <div class="nodes-row__body">
        <div class="nodes-meta-grid">
          ${renderNodeMeta("Status", node.connected ? "Connected" : "Offline")}
          ${renderNodeMeta("Pairing", node.paired ? "Paired" : "Unpaired")}
          ${renderNodeMeta("Platform", node.platform)}
          ${renderNodeMeta("Version", node.version ?? "unknown")}
          ${renderNodeMeta("Approved", formatRelativeTimestamp(node.approvedAtMs))}
          ${renderNodeMeta("Capabilities", capsPreview)}
          ${node.deviceFamily ? renderNodeMeta("Device", node.deviceFamily) : nothing}
          ${node.modelIdentifier ? renderNodeMeta("Model", node.modelIdentifier) : nothing}
        </div>
        <div class="nodes-chip-section">
          <div class="nodes-chip-section__title">Capability lanes</div>
          <div class="chip-row">
            <span class="chip ${node.execCapable ? "chip-ok" : ""}">exec</span>
            <span class="chip ${node.browserCapable ? "chip-ok" : ""}">browser</span>
            <span class="chip ${node.mediaCapable ? "chip-ok" : ""}">media</span>
          </div>
        </div>
        ${node.commands.length > 0
          ? html`
              <div class="nodes-chip-section">
                <div class="nodes-chip-section__title">Commands</div>
                <div class="chip-row">
                  ${node.commands
                    .slice(0, 18)
                    .map((command) => html`<span class="chip">${command}</span>`)}
                  ${node.commands.length > 18
                    ? html`<span class="chip">+${node.commands.length - 18} more</span>`
                    : nothing}
                </div>
              </div>
            `
          : nothing}
        ${node.caps.length > 0
          ? html`
              <div class="nodes-chip-section">
                <div class="nodes-chip-section__title">Raw caps</div>
                <div class="chip-row">
                  ${node.caps.slice(0, 18).map((cap) => html`<span class="chip">${cap}</span>`)}
                  ${node.caps.length > 18
                    ? html`<span class="chip">+${node.caps.length - 18} more</span>`
                    : nothing}
                </div>
              </div>
            `
          : nothing}
        ${node.permissions.length > 0
          ? html`
              <div class="nodes-chip-section">
                <div class="nodes-chip-section__title">Permissions</div>
                <div class="chip-row">
                  ${node.permissions.map(
                    ([key, enabled]) =>
                      html`<span class="chip ${enabled ? "chip-ok" : "chip-warn"}">
                        ${key}: ${enabled ? "on" : "off"}
                      </span>`,
                  )}
                </div>
              </div>
            `
          : nothing}
      </div>
    </details>
  `;
}

function renderNodeMeta(label: string, value: string) {
  return html`
    <div class="nodes-meta-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderNodeSetupGuide(fleet: NodeFleetView) {
  return html`
    <section class="card nodes-setup-guide">
      <div class="card-title">Add a node</div>
      <div class="card-sub">
        Use a node when another machine should provide shell, browser, screen, camera, or canvas
        capabilities.
      </div>
      <div class="nodes-setup-list">
        <div>
          <span>Foreground test</span>
          <code>kova node run --host 127.0.0.1 --port 18789</code>
        </div>
        <div>
          <span>Install service</span>
          <code>kova node install --host &lt;gateway-host&gt; --port 18789</code>
        </div>
        <div>
          <span>Approve pairing</span>
          <code>kova devices list && kova devices approve &lt;requestId&gt;</code>
        </div>
      </div>
      <div class="nodes-setup-note">
        ${fleet.pendingDevices > 0
          ? html`<span class="nodes-status-badge is-warn">${fleet.pendingDevices} waiting</span>`
          : html`<span class="nodes-status-badge is-ok">No pending requests</span>`}
      </div>
    </section>
  `;
}

function renderDevices(props: NodesProps, fleet: NodeFleetView) {
  const list = props.devicesList ?? { pending: [], paired: [] };
  const pending = Array.isArray(list.pending) ? list.pending : [];
  const paired = Array.isArray(list.paired) ? list.paired : [];
  const pairedByDeviceId = new Map(
    paired
      .map((device) => [normalizeOptionalString(device.deviceId), device] as const)
      .filter((entry): entry is [string, PairedDevice] => Boolean(entry[0])),
  );
  return html`
    <section class="card nodes-devices">
      <div class="nodes-section-head">
        <div>
          <div class="card-title">Pairing & device tokens</div>
          <div class="card-sub">
            ${pending.length} pending · ${paired.length} paired · ${fleet.activeTokens} active
            token${fleet.activeTokens === 1 ? "" : "s"}.
          </div>
        </div>
        <button class="btn" ?disabled=${props.devicesLoading} @click=${props.onDevicesRefresh}>
          ${props.devicesLoading ? t("common.loading") : t("common.refresh")}
        </button>
      </div>
      ${props.devicesError
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.devicesError}</div>`
        : nothing}
      <div class="nodes-device-list">
        ${pending.length > 0
          ? html`
              <div class="nodes-group-label">Pending approval</div>
              ${pending.map((req) =>
                renderPendingDevice(req, props, lookupPairedDevice(pairedByDeviceId, req)),
              )}
            `
          : nothing}
        ${paired.length > 0
          ? html`
              <div class="nodes-group-label">Paired devices</div>
              ${paired.map((device) => renderPairedDevice(device, props))}
            `
          : nothing}
        ${pending.length === 0 && paired.length === 0
          ? html` <div class="nodes-empty nodes-empty--compact">No paired devices.</div> `
          : nothing}
      </div>
    </section>
  `;
}

function lookupPairedDevice(
  pairedByDeviceId: ReadonlyMap<string, PairedDevice>,
  request: Pick<PendingDevice, "deviceId" | "publicKey">,
): PairedDevice | undefined {
  const deviceId = normalizeOptionalString(request.deviceId);
  if (!deviceId) {
    return undefined;
  }
  const paired = pairedByDeviceId.get(deviceId);
  if (!paired) {
    return undefined;
  }
  const requestPublicKey = normalizeOptionalString(request.publicKey);
  const pairedPublicKey = normalizeOptionalString(paired.publicKey);
  if (requestPublicKey && pairedPublicKey && requestPublicKey !== pairedPublicKey) {
    return undefined;
  }
  return paired;
}

function formatAccessSummary(access: DevicePairingAccessSummary | null): string {
  if (!access) {
    return "none";
  }
  return `roles: ${formatList(access.roles)} · scopes: ${formatList(access.scopes)}`;
}

function renderPendingApprovalNote(kind: PendingDeviceApprovalKind) {
  switch (kind) {
    case "scope-upgrade":
      return "scope upgrade requires approval";
    case "role-upgrade":
      return "role upgrade requires approval";
    case "re-approval":
      return "reconnect details changed; approval required";
    case "new-pairing":
      return "new device pairing request";
  }
  const exhaustiveKind: never = kind;
  void exhaustiveKind;
  throw new Error("unsupported pending approval kind");
}

function renderPendingDevice(req: PendingDevice, props: NodesProps, paired?: PairedDevice) {
  const name = normalizeOptionalString(req.displayName) || req.deviceId;
  const age = typeof req.ts === "number" ? formatRelativeTimestamp(req.ts) : t("common.na");
  const approval = resolvePendingDeviceApprovalState(req, paired);
  const repair = req.isRepair ? " · repair" : "";
  const ip = req.remoteIp ? ` · ${req.remoteIp}` : "";
  return html`
    <div class="nodes-device-row is-pending">
      <div class="list-main">
        <div class="list-title">${name}</div>
        <div class="list-sub">${req.deviceId}${ip}</div>
        <div class="muted" style="margin-top: 6px;">
          ${renderPendingApprovalNote(approval.kind)} · requested ${age}${repair}
        </div>
        <div class="muted" style="margin-top: 6px;">
          requested: ${formatAccessSummary(approval.requested)}
        </div>
        ${approval.approved
          ? html`
              <div class="muted" style="margin-top: 6px;">
                approved now: ${formatAccessSummary(approval.approved)}
              </div>
            `
          : nothing}
      </div>
      <div class="nodes-row-actions">
        <button class="btn btn--sm primary" @click=${() => props.onDeviceApprove(req.requestId)}>
          Approve
        </button>
        <button class="btn btn--sm" @click=${() => props.onDeviceReject(req.requestId)}>
          Reject
        </button>
      </div>
    </div>
  `;
}

function renderPairedDevice(device: PairedDevice, props: NodesProps) {
  const name = normalizeOptionalString(device.displayName) || device.deviceId;
  const ip = device.remoteIp ? ` · ${device.remoteIp}` : "";
  const roles = `roles: ${formatList(device.roles)}`;
  const scopes = `scopes: ${formatList(device.scopes)}`;
  const tokens = Array.isArray(device.tokens) ? device.tokens : [];
  return html`
    <div class="nodes-device-row">
      <div class="list-main">
        <div class="list-title">${name}</div>
        <div class="list-sub">${device.deviceId}${ip}</div>
        <div class="muted" style="margin-top: 6px;">${roles} · ${scopes}</div>
        ${tokens.length === 0
          ? html` <div class="muted" style="margin-top: 6px">Tokens: none</div> `
          : html`
              <div class="nodes-token-stack">
                <div class="nodes-group-label">Tokens</div>
                ${tokens.map((token) => renderTokenRow(device.deviceId, token, props))}
              </div>
            `}
      </div>
    </div>
  `;
}

function renderTokenRow(deviceId: string, token: DeviceTokenSummary, props: NodesProps) {
  const status = token.revokedAtMs ? "revoked" : "active";
  const scopes = `scopes: ${formatList(token.scopes)}`;
  const when = formatRelativeTimestamp(
    token.rotatedAtMs ?? token.createdAtMs ?? token.lastUsedAtMs ?? null,
  );
  return html`
    <div class="nodes-token-row">
      <div class="list-sub">${token.role} · ${status} · ${scopes} · ${when}</div>
      <div class="nodes-row-actions">
        <button
          class="btn btn--sm"
          @click=${() => props.onDeviceRotate(deviceId, token.role, token.scopes)}
        >
          Rotate
        </button>
        ${token.revokedAtMs
          ? nothing
          : html`
              <button
                class="btn btn--sm danger"
                @click=${() => props.onDeviceRevoke(deviceId, token.role)}
              >
                Revoke
              </button>
            `}
      </div>
    </div>
  `;
}

type BindingAgent = {
  id: string;
  name: string | undefined;
  index: number;
  isDefault: boolean;
  binding: string | null;
};

type BindingNode = NodeTargetOption;

type BindingState = {
  ready: boolean;
  disabled: boolean;
  configDirty: boolean;
  configLoading: boolean;
  configSaving: boolean;
  defaultBinding?: string | null;
  agents: BindingAgent[];
  nodes: BindingNode[];
  onBindDefault: (nodeId: string | null) => void;
  onBindAgent: (agentIndex: number, nodeId: string | null) => void;
  onSave: () => void;
  onLoadConfig: () => void;
  formMode: "form" | "raw";
};

function resolveBindingsState(props: NodesProps): BindingState {
  const config = props.configForm;
  const nodes = resolveExecNodes(props.nodes);
  const { defaultBinding, agents } = resolveAgentBindings(config);
  const ready = Boolean(config);
  const disabled = props.configSaving || props.configFormMode === "raw";
  return {
    ready,
    disabled,
    configDirty: props.configDirty,
    configLoading: props.configLoading,
    configSaving: props.configSaving,
    defaultBinding,
    agents,
    nodes,
    onBindDefault: props.onBindDefault,
    onBindAgent: props.onBindAgent,
    onSave: props.onSaveBindings,
    onLoadConfig: props.onLoadConfig,
    formMode: props.configFormMode,
  };
}

function renderBindings(state: BindingState) {
  const supportsBinding = state.nodes.length > 0;
  const defaultValue = state.defaultBinding ?? "";
  return html`
    <section class="card nodes-binding">
      <div class="nodes-section-head">
        <div>
          <div class="card-title">Execution routing</div>
          <div class="card-sub">Choose which node receives approved shell execution.</div>
        </div>
        <button
          class="btn"
          ?disabled=${state.disabled || !state.configDirty}
          @click=${state.onSave}
        >
          ${state.configSaving ? t("common.saving") : t("common.save")}
        </button>
      </div>

      ${state.formMode === "raw"
        ? html`
            <div class="callout warn" style="margin-top: 12px">
              ${t("nodes.binding.formModeHint")}
            </div>
          `
        : nothing}
      ${!state.ready
        ? html`<div class="row" style="margin-top: 12px; gap: 12px;">
            <div class="muted">${t("nodes.binding.loadConfigHint")}</div>
            <button class="btn" ?disabled=${state.configLoading} @click=${state.onLoadConfig}>
              ${state.configLoading ? t("common.loading") : t("common.loadConfig")}
            </button>
          </div>`
        : html`
            <div class="list" style="margin-top: 16px;">
              <div class="list-item">
                <div class="list-main">
                  <div class="list-title">Default exec target</div>
                  <div class="list-sub">
                    Route shell execution to any node or pin it to one host.
                  </div>
                </div>
                <div class="list-meta">
                  <label class="field">
                    <span>${t("nodes.binding.node")}</span>
                    <select
                      ?disabled=${state.disabled || !supportsBinding}
                      @change=${(event: Event) => {
                        const target = event.target as HTMLSelectElement;
                        const value = target.value.trim();
                        state.onBindDefault(value ? value : null);
                      }}
                    >
                      <option value="" ?selected=${defaultValue === ""}>Any node</option>
                      ${state.nodes.map(
                        (node) =>
                          html`<option value=${node.id} ?selected=${defaultValue === node.id}>
                            ${node.label}
                          </option>`,
                      )}
                    </select>
                  </label>
                  ${!supportsBinding
                    ? html` <div class="muted">No nodes with system.run available.</div> `
                    : nothing}
                </div>
              </div>

              ${state.agents.length === 0
                ? html` <div class="muted">No agents found.</div> `
                : state.agents.map((agent) => renderAgentBinding(agent, state))}
            </div>
          `}
    </section>
  `;
}

function renderAgentBinding(agent: BindingAgent, state: BindingState) {
  const bindingValue = agent.binding ?? "__default__";
  const label = agent.name?.trim() ? `${agent.name} (${agent.id})` : agent.id;
  const supportsBinding = state.nodes.length > 0;
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${label}</div>
        <div class="list-sub">
          ${agent.isDefault ? "default agent" : "agent"} ·
          ${bindingValue === "__default__"
            ? `uses default (${state.defaultBinding ?? "any"})`
            : `override: ${agent.binding}`}
        </div>
      </div>
      <div class="list-meta">
        <label class="field">
          <span>Binding</span>
          <select
            ?disabled=${state.disabled || !supportsBinding}
            @change=${(event: Event) => {
              const target = event.target as HTMLSelectElement;
              const value = target.value.trim();
              state.onBindAgent(agent.index, value === "__default__" ? null : value);
            }}
          >
            <option value="__default__" ?selected=${bindingValue === "__default__"}>
              Use default
            </option>
            ${state.nodes.map(
              (node) =>
                html`<option value=${node.id} ?selected=${bindingValue === node.id}>
                  ${node.label}
                </option>`,
            )}
          </select>
        </label>
      </div>
    </div>
  `;
}

function resolveExecNodes(nodes: Array<Record<string, unknown>>): BindingNode[] {
  return resolveNodeTargets(nodes, ["system.run"]);
}

function resolveAgentBindings(config: Record<string, unknown> | null): {
  defaultBinding?: string | null;
  agents: BindingAgent[];
} {
  const fallbackAgent: BindingAgent = {
    id: "main",
    name: undefined,
    index: 0,
    isDefault: true,
    binding: null,
  };
  if (!config || typeof config !== "object") {
    return { defaultBinding: null, agents: [fallbackAgent] };
  }
  const tools = (config.tools ?? {}) as Record<string, unknown>;
  const exec = (tools.exec ?? {}) as Record<string, unknown>;
  const defaultBinding =
    typeof exec.node === "string" && exec.node.trim() ? exec.node.trim() : null;

  const agentsNode = (config.agents ?? {}) as Record<string, unknown>;
  if (!Array.isArray(agentsNode.list) || agentsNode.list.length === 0) {
    return { defaultBinding, agents: [fallbackAgent] };
  }

  const agents = resolveConfigAgents(config).map((entry) => {
    const toolsEntry = (entry.record.tools ?? {}) as Record<string, unknown>;
    const execEntry = (toolsEntry.exec ?? {}) as Record<string, unknown>;
    const binding =
      typeof execEntry.node === "string" && execEntry.node.trim() ? execEntry.node.trim() : null;
    return {
      id: entry.id,
      name: entry.name,
      index: entry.index,
      isDefault: entry.isDefault,
      binding,
    };
  });

  if (agents.length === 0) {
    agents.push(fallbackAgent);
  }

  return { defaultBinding, agents };
}
