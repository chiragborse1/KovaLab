import type { IncomingMessage, ServerResponse } from "node:http";
import type { KovaConfig } from "../config/types.kova.js";
export type McpRequestContext = {
    sessionKey: string;
    messageProvider: string | undefined;
    accountId: string | undefined;
    senderIsOwner: boolean;
};
export declare function validateMcpLoopbackRequest(params: {
    req: IncomingMessage;
    res: ServerResponse;
    ownerToken: string;
    nonOwnerToken: string;
}): {
    senderIsOwner: boolean;
} | null;
export declare function readMcpHttpBody(req: IncomingMessage): Promise<string>;
export declare function resolveMcpRequestContext(req: IncomingMessage, cfg: KovaConfig, auth: {
    senderIsOwner: boolean;
}): McpRequestContext;
