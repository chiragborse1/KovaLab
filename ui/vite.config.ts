import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DEV_PORT = 5173;

function normalizeDevPort(input: string | undefined): number {
  const value = Number.parseInt(input ?? "", 10);
  if (Number.isInteger(value) && value > 0 && value <= 65535) {
    return value;
  }
  return DEFAULT_DEV_PORT;
}

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed === "./") {
    return "./";
  }
  if (trimmed.endsWith("/")) {
    return trimmed;
  }
  return `${trimmed}/`;
}

export default defineConfig(() => {
  const envBase = process.env.KOVA_CONTROL_UI_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";
  const port = normalizeDevPort(process.env.KOVA_CONTROL_UI_DEV_PORT);
  const strictPort = process.env.KOVA_CONTROL_UI_STRICT_PORT === "1";
  return {
    base,
    publicDir: path.resolve(here, "public"),
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui"),
      emptyOutDir: true,
      sourcemap: true,
      // Keep CI/onboard logs clean; current control UI chunking is intentionally above 500 kB.
      chunkSizeWarningLimit: 1024,
    },
    server: {
      host: true,
      port,
      strictPort,
    },
    plugins: [
      {
        name: "control-ui-dev-stubs",
        configureServer(server) {
          server.middlewares.use("/__kova/control-ui-config.json", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                basePath: "/",
                assistantName: "",
                assistantAvatar: "",
              }),
            );
          });
        },
      },
    ],
  };
});
