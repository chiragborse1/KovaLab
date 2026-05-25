import type { KovaConfig } from "../config/types.kova.js";
import { GatewayClient, type GatewayClientOptions } from "./client.js";
export declare function createOperatorApprovalsGatewayClient(params: Pick<GatewayClientOptions, "clientDisplayName" | "onClose" | "onConnectError" | "onEvent" | "onHelloOk"> & {
    config: KovaConfig;
    gatewayUrl?: string;
}): Promise<GatewayClient>;
export declare function withOperatorApprovalsGatewayClient<T>(params: {
    config: KovaConfig;
    gatewayUrl?: string;
    clientDisplayName: string;
}, run: (client: GatewayClient) => Promise<T>): Promise<T>;
