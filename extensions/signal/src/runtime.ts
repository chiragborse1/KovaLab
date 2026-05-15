import type { PluginRuntime } from "getkova/plugin-sdk/core";
import { createPluginRuntimeStore } from "getkova/plugin-sdk/runtime-store";

const {
  setRuntime: setSignalRuntime,
  clearRuntime: clearSignalRuntime,
  getRuntime: getSignalRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "signal",
  errorMessage: "Signal runtime not initialized",
});
export { clearSignalRuntime, getSignalRuntime, setSignalRuntime };
