import type { NamedCommandDescriptor } from "./command-group-descriptors.js";
export type SubCliDescriptor = NamedCommandDescriptor;
export declare const SUB_CLI_DESCRIPTORS: readonly ({
    readonly name: "acp";
    readonly description: "Agent Control Protocol tools";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "gateway";
    readonly description: "Run, inspect, and query the WebSocket Gateway";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "daemon";
    readonly description: "Gateway service (legacy alias)";
    readonly hasSubcommands: true;
    readonly hidden: true;
} | {
    readonly name: "logs";
    readonly description: "Tail gateway file logs via RPC";
    readonly hasSubcommands: false;
    readonly hidden?: undefined;
} | {
    readonly name: "system";
    readonly description: "System events, heartbeat, and presence";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "models";
    readonly description: "Discover, scan, and configure models";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "infer";
    readonly description: "Run provider-backed inference commands";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "capability";
    readonly description: "Run provider-backed inference commands (fallback alias: infer)";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "approvals";
    readonly description: "Manage exec approvals (gateway or node host)";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "exec-policy";
    readonly description: "Show or synchronize requested exec policy with host approvals";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "nodes";
    readonly description: "Manage gateway-owned node pairing and node commands";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "devices";
    readonly description: "Device pairing + token management";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "node";
    readonly description: "Run and manage the headless node host service";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "sandbox";
    readonly description: "Manage sandbox containers for agent isolation";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "tui";
    readonly description: "Open a terminal UI connected to the Gateway";
    readonly hasSubcommands: false;
    readonly hidden?: undefined;
} | {
    readonly name: "terminal";
    readonly description: "Open a local terminal UI (alias for tui --local)";
    readonly hasSubcommands: false;
    readonly hidden?: undefined;
} | {
    readonly name: "chat";
    readonly description: "Open a local terminal UI (alias for tui --local)";
    readonly hasSubcommands: false;
    readonly hidden?: undefined;
} | {
    readonly name: "cron";
    readonly description: "Manage cron jobs via the Gateway scheduler";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "dns";
    readonly description: "DNS helpers for wide-area discovery (Tailscale + CoreDNS)";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "docs";
    readonly description: "Search the live Kova docs";
    readonly hasSubcommands: false;
    readonly hidden?: undefined;
} | {
    readonly name: "qa";
    readonly description: "Run QA scenarios and launch the private QA debugger UI";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "proxy";
    readonly description: "Run the Kova debug proxy and inspect captured traffic";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "hooks";
    readonly description: "Manage internal agent hooks";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "webhooks";
    readonly description: "Webhook helpers and integrations";
    readonly hasSubcommands: true;
    readonly hidden?: undefined;
} | {
    readonly name: "qr";
    readonly description: "Generate mobile pairing QR/setup code";
    readonly hasSubcommands: false;
    readonly hidden?: undefined;
} | {
    readonly name: "clawbot";
    readonly description: "Legacy clawbot command aliases";
    readonly hasSubcommands: true;
    readonly hidden: true;
} | {
    readonly hidden?: undefined;
    readonly name: "pairing";
    readonly description: "Secure DM pairing (approve inbound requests)";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "plugins";
    readonly description: "Manage Kova plugins";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "channels";
    readonly description: "Manage connected chat channels (Telegram, Discord, etc.)";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "directory";
    readonly description: "Lookup contact and group IDs (self, peers, groups) for supported chat channels";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "security";
    readonly description: "Security tools and local config audits";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "secrets";
    readonly description: "Secrets runtime reload controls";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "skills";
    readonly description: "List and inspect available skills";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "update";
    readonly description: "Update Kova and inspect update channel status";
    readonly hasSubcommands: true;
} | {
    readonly hidden?: undefined;
    readonly name: "completion";
    readonly description: "Generate shell completion script";
    readonly hasSubcommands: false;
})[];
export declare function getSubCliEntries(): ReadonlyArray<SubCliDescriptor>;
export declare function getSubCliCommandsWithSubcommands(): string[];
