import { definePluginEntry } from "getkova/plugin-sdk/plugin-entry";
import type { AnyAgentTool, KovaPluginApi, KovaPluginToolFactory } from "./runtime-api.js";
import { createLobsterTool } from "./src/lobster-tool.js";

export default definePluginEntry({
  id: "lobster",
  name: "Lobster",
  description: "Optional local shell helper tools",
  register(api: KovaPluginApi) {
    api.registerTool(
      ((ctx) => {
        if (ctx.sandboxed) {
          return null;
        }
        const taskFlow =
          api.runtime?.taskFlow && ctx.sessionKey
            ? api.runtime.taskFlow.fromToolContext(ctx)
            : undefined;
        return createLobsterTool(api, { taskFlow }) as AnyAgentTool;
      }) as KovaPluginToolFactory,
      { optional: true },
    );
  },
});
