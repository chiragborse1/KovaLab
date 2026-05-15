export type ExtraGatewayService = {
    platform: "darwin" | "linux" | "win32";
    label: string;
    detail: string;
    scope: "user" | "system";
    marker?: "kova" | "openclaw" | "clawdbot";
    legacy?: boolean;
};
export type FindExtraGatewayServicesOptions = {
    deep?: boolean;
};
type Marker = "kova" | "openclaw" | "clawdbot";
export declare function renderGatewayServiceCleanupHints(env?: Record<string, string | undefined>): string[];
export declare function detectMarkerLineWithGateway(contents: string): Marker | null;
export declare function findExtraGatewayServices(env: Record<string, string | undefined>, opts?: FindExtraGatewayServicesOptions): Promise<ExtraGatewayService[]>;
export {};
