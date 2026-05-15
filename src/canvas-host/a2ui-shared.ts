import { lowercasePreservingWhitespace } from "../shared/string-coerce.js";

export const A2UI_PATH = "/__kova__/a2ui";
export const LEGACY_A2UI_PATH = "/__kova__/a2ui";

export const CANVAS_HOST_PATH = "/__kova__/canvas";
export const LEGACY_CANVAS_HOST_PATH = "/__kova__/canvas";

export const CANVAS_WS_PATH = "/__kova__/ws";
export const LEGACY_CANVAS_WS_PATH = "/__kova__/ws";

export function isA2uiPath(pathname: string): boolean {
  return resolveA2uiPathBase(pathname) !== undefined;
}

export function resolveA2uiPathBase(pathname: string): string | undefined {
  return [A2UI_PATH, LEGACY_A2UI_PATH].find(
    (basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`),
  );
}

export function isCanvasHostPath(pathname: string): boolean {
  return resolveCanvasHostPathBase(pathname) !== undefined;
}

export function resolveCanvasHostPathBase(pathname: string): string | undefined {
  return [CANVAS_HOST_PATH, LEGACY_CANVAS_HOST_PATH].find(
    (basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`),
  );
}

export function isCanvasWsPath(pathname: string): boolean {
  return pathname === CANVAS_WS_PATH || pathname === LEGACY_CANVAS_WS_PATH;
}

export function isCanvasRoutePath(pathname: string): boolean {
  return isA2uiPath(pathname) || isCanvasHostPath(pathname) || isCanvasWsPath(pathname);
}

export function injectCanvasLiveReload(html: string): string {
  const snippet = `
<script>
(() => {
  // Cross-platform action bridge helper.
  // Works on:
  // - iOS: window.webkit.messageHandlers.kovaCanvasA2UIAction.postMessage(...)
  // - Android: window.kovaCanvasA2UIAction.postMessage(...)
  const handlerNames = ["kovaCanvasA2UIAction", "kovaCanvasA2UIAction"];
  function postToNode(payload) {
    try {
      const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
      for (const name of handlerNames) {
        const iosHandler = globalThis.webkit?.messageHandlers?.[name];
        if (iosHandler && typeof iosHandler.postMessage === "function") {
          iosHandler.postMessage(raw);
          return true;
        }
        const androidHandler = globalThis[name];
        if (androidHandler && typeof androidHandler.postMessage === "function") {
          // Important: call as a method on the interface object (binding matters on Android WebView).
          androidHandler.postMessage(raw);
          return true;
        }
      }
    } catch {}
    return false;
  }
  function sendUserAction(userAction) {
    const id =
      (userAction && typeof userAction.id === "string" && userAction.id.trim()) ||
      (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const action = { ...userAction, id };
    return postToNode({ userAction: action });
  }
  globalThis.Kova = globalThis.Kova ?? {};
  globalThis.Kova.postMessage = postToNode;
  globalThis.Kova.sendUserAction = sendUserAction;
  globalThis.Kova = globalThis.Kova ?? {};
  globalThis.Kova.postMessage = postToNode;
  globalThis.Kova.sendUserAction = sendUserAction;
  globalThis.kovaPostMessage = postToNode;
  globalThis.kovaSendUserAction = sendUserAction;
  globalThis.kovaPostMessage = postToNode;
  globalThis.kovaSendUserAction = sendUserAction;

  try {
    const cap = new URLSearchParams(location.search).get("oc_cap");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const capQuery = cap ? "?oc_cap=" + encodeURIComponent(cap) : "";
    const ws = new WebSocket(proto + "://" + location.host + ${JSON.stringify(CANVAS_WS_PATH)} + capQuery);
    ws.onmessage = (ev) => {
      if (String(ev.data || "") === "reload") location.reload();
    };
  } catch {}
})();
</script>
`.trim();

  const idx = lowercasePreservingWhitespace(html).lastIndexOf("</body>");
  if (idx >= 0) {
    return `${html.slice(0, idx)}\n${snippet}\n${html.slice(idx)}`;
  }
  return `${html}\n${snippet}\n`;
}
