/**
 * Standalone MCP server for selected built-in Kova tools.
 *
 * Run via: node --import tsx src/mcp/kova-tools-serve.ts
 * Or: bun src/mcp/kova-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveKovaToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

export function createKovaToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveKovaToolsForMcp();
  return createToolsMcpServer({ name: "kova-tools", tools });
}

export async function serveKovaToolsMcp(): Promise<void> {
  const server = createKovaToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveKovaToolsMcp().catch((err) => {
    process.stderr.write(`kova-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
