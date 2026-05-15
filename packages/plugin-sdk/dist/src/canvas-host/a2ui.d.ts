import type { IncomingMessage, ServerResponse } from "node:http";
export { A2UI_PATH, CANVAS_HOST_PATH, CANVAS_WS_PATH, injectCanvasLiveReload, isA2uiPath, isCanvasRoutePath, isCanvasWsPath, LEGACY_A2UI_PATH, LEGACY_CANVAS_HOST_PATH, LEGACY_CANVAS_WS_PATH, resolveA2uiPathBase, resolveCanvasHostPathBase, } from "./a2ui-shared.js";
export declare function handleA2uiHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
