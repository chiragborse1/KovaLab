export type ConfigMcpServers = Record<string, Record<string, unknown>>;
export type OpenClawMcpHttpTransport = "sse" | "streamable-http";
export declare function resolveOpenClawMcpTransportAlias(value: unknown): OpenClawMcpHttpTransport | undefined;
export declare function isKnownCliMcpTypeAlias(value: unknown): boolean;
export declare function canonicalizeConfiguredMcpServer(server: Record<string, unknown>): Record<string, unknown>;
export declare function normalizeConfiguredMcpServers(value: unknown): ConfigMcpServers;
