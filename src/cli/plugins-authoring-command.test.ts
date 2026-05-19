import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { defineToolPlugin, getToolPluginMetadata } from "../plugin-sdk/tool-plugin.js";
import {
  buildToolPluginManifest,
  buildToolPluginPackageManifest,
  loadToolPlugin,
  runPluginsInitCommand,
  validateToolPluginProject,
} from "./plugins-authoring-command.js";

function createDemoMetadata() {
  const entry = defineToolPlugin({
    id: "demo-tools",
    name: "Demo Tools",
    description: "Demo tool plugin.",
    tools: (tool) => [
      tool({
        name: "demo_echo",
        description: "Echo input.",
        parameters: Type.Object({ input: Type.String() }),
        execute: ({ input }) => ({ input }),
      }),
    ],
  });
  const metadata = getToolPluginMetadata(entry);
  if (!metadata) {
    throw new Error("missing metadata");
  }
  return metadata;
}

function createOptionalDemoMetadata() {
  const entry = defineToolPlugin({
    id: "optional-demo-tools",
    name: "Optional Demo Tools",
    description: "Optional demo tool plugin.",
    tools: (tool) => [
      tool({
        name: "demo_optional_echo",
        description: "Echo input.",
        parameters: Type.Object({ input: Type.String() }),
        optional: true,
        execute: ({ input }) => ({ input }),
      }),
    ],
  });
  const metadata = getToolPluginMetadata(entry);
  if (!metadata) {
    throw new Error("missing metadata");
  }
  return metadata;
}

describe("plugin authoring commands", () => {
  it("generates manifest metadata from defineToolPlugin metadata", () => {
    const metadata = createDemoMetadata();

    expect(buildToolPluginManifest({ metadata, packageManifest: { version: "1.2.3" } })).toEqual({
      id: "demo-tools",
      name: "Demo Tools",
      description: "Demo tool plugin.",
      version: "1.2.3",
      configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      activation: { onStartup: true },
      contracts: { tools: ["demo_echo"] },
    });
  });

  it("generates optional tool metadata for optional tool plugins", () => {
    const metadata = createOptionalDemoMetadata();

    expect(buildToolPluginManifest({ metadata, packageManifest: { version: "1.2.3" } })).toEqual({
      id: "optional-demo-tools",
      name: "Optional Demo Tools",
      description: "Optional demo tool plugin.",
      version: "1.2.3",
      configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      activation: { onStartup: true },
      contracts: { tools: ["demo_optional_echo"] },
      toolMetadata: {
        demo_optional_echo: { optional: true },
      },
    });
  });

  it("preserves manifest-owned metadata while updating generated fields", () => {
    const metadata = createOptionalDemoMetadata();
    const existingManifest = {
      id: "old-id",
      name: "Old name",
      uiHints: { apiKey: { secret: true } },
      contracts: {
        tools: ["stale_tool"],
        agentToolResultMiddleware: ["existing-middleware"],
      },
      toolMetadata: {
        demo_optional_echo: {
          authSignals: [{ provider: "demo", envVars: ["DEMO_API_KEY"] }],
          configSignals: [{ rootPath: "plugins.entries.optional-demo-tools.config.apiKey" }],
        },
        stale_tool: {
          optional: true,
        },
      },
    };

    const manifest = buildToolPluginManifest({
      metadata,
      packageManifest: { version: "1.2.3" },
      existingManifest,
    });

    expect(manifest).toMatchObject({
      id: "optional-demo-tools",
      name: "Optional Demo Tools",
      uiHints: { apiKey: { secret: true } },
      contracts: {
        tools: ["demo_optional_echo"],
        agentToolResultMiddleware: ["existing-middleware"],
      },
      toolMetadata: {
        demo_optional_echo: {
          optional: true,
          authSignals: [{ provider: "demo", envVars: ["DEMO_API_KEY"] }],
          configSignals: [{ rootPath: "plugins.entries.optional-demo-tools.config.apiKey" }],
        },
      },
    });
    expect((manifest.toolMetadata as Record<string, unknown>).stale_tool).toBeUndefined();
    expect(
      validateToolPluginProject({
        metadata,
        entry: "./src/index.ts",
        manifest,
        packageManifest: { version: "1.2.3", kova: { extensions: ["./src/index.ts"] } },
      }),
    ).toEqual([]);
  });

  it("drops stale manifest-owned tool metadata when no generated metadata remains", () => {
    const metadata = createDemoMetadata();
    const packageManifest = { version: "1.2.3", kova: { extensions: ["./src/index.ts"] } };
    const manifest = buildToolPluginManifest({
      metadata,
      packageManifest,
      existingManifest: {
        id: "demo-tools",
        name: "Demo Tools",
        toolMetadata: {
          stale_tool: { optional: true },
        },
      },
    });

    expect(manifest.toolMetadata).toBeUndefined();
    expect(
      validateToolPluginProject({
        metadata,
        entry: "./src/index.ts",
        manifest,
        packageManifest,
      }),
    ).toEqual([]);
  });

  it("aligns package metadata with the selected runtime extension entry", () => {
    expect(
      buildToolPluginPackageManifest({
        packageManifest: {
          name: "demo",
          kova: { setupEntry: "./setup.ts", extensions: ["./src/other.ts"] },
        },
        entry: "./src/index.ts",
      }),
    ).toEqual({
      name: "demo",
      kova: {
        setupEntry: "./setup.ts",
        extensions: ["./src/index.ts"],
      },
    });
  });

  it("validates manifest tools and package entry metadata", () => {
    const metadata = createDemoMetadata();
    const packageManifest = { version: "1.2.3", kova: { extensions: ["./src/index.ts"] } };

    expect(
      validateToolPluginProject({
        metadata,
        entry: "./src/index.ts",
        manifest: buildToolPluginManifest({ metadata, packageManifest }),
        packageManifest,
      }),
    ).toEqual([]);
  });

  it("reports stale manifest contracts", () => {
    const metadata = createDemoMetadata();

    expect(
      validateToolPluginProject({
        metadata,
        entry: "./src/index.ts",
        manifest: {
          id: "demo-tools",
          configSchema: {},
          contracts: { tools: ["other_tool"] },
        },
        packageManifest: { kova: { extensions: ["./src/index.ts"] } },
      }),
    ).toEqual([
      "kova.plugin.json generated metadata is stale. Run kova plugins build.",
      "kova.plugin.json contracts.tools is missing: demo_echo",
      "kova.plugin.json contracts.tools has no matching defineToolPlugin tool: other_tool",
    ]);
  });

  it("reports missing entries with an author-facing path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-plugin-missing-"));

    await expect(
      loadToolPlugin({ rootDir: tmpDir, entryPath: path.join(tmpDir, "dist/index.js") }),
    ).rejects.toThrow("plugin entry not found: ./dist/index.js");
  });

  it("loads source entries that import the Kova plugin SDK package subpath", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-plugin-source-"));
    const sourceDir = path.join(tmpDir, "src");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify(
        {
          name: "kova-plugin-source-demo",
          type: "module",
          kova: { extensions: ["./src/index.ts"] },
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(
      path.join(sourceDir, "index.ts"),
      `import { defineToolPlugin } from "getkova/plugin-sdk/tool-plugin";

export default defineToolPlugin({
  id: "source-demo",
  name: "Source Demo",
  description: "Source demo plugin.",
  tools: (tool) => [
    tool({
      name: "source_echo",
      description: "Echo input.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      execute: async () => ({ ok: true }),
    }),
  ],
});
`,
    );

    const loaded = await loadToolPlugin({
      rootDir: tmpDir,
      entryPath: path.join(sourceDir, "index.ts"),
    });

    expect(loaded.metadata.id).toBe("source-demo");
    expect(loaded.metadata.tools.map((tool) => tool.name)).toEqual(["source_echo"]);
  });

  it("scaffolds a dist-entry tool plugin project", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kova-plugin-init-"));
    const projectDir = path.join(tmpDir, "stock-quotes");

    await runPluginsInitCommand("stock-quotes", {
      directory: projectDir,
      name: 'Stock "Quotes"',
    });

    expect(fs.readFileSync(path.join(projectDir, "src/index.ts"), "utf8")).toContain(
      'name: "Stock \\"Quotes\\""',
    );
    expect(
      JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8")),
    ).toMatchObject({
      dependencies: {
        typebox: "^1.1.38",
      },
      peerDependencies: {
        getkova: ">=2.0.0-beta.5",
      },
      devDependencies: {
        getkova: "latest",
        typescript: "^5.9.0",
        vitest: "^3.2.0",
      },
      scripts: {
        "plugin:build": "npm run build && kova plugins build --entry ./dist/index.js",
        "plugin:validate": "npm run build && kova plugins validate --entry ./dist/index.js",
      },
      kova: {
        extensions: ["./dist/index.js"],
      },
    });
    expect(
      JSON.parse(fs.readFileSync(path.join(projectDir, "kova.plugin.json"), "utf8")),
    ).toMatchObject({
      id: "stock-quotes",
      name: 'Stock "Quotes"',
      configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
      contracts: { tools: ["echo"] },
    });
    expect(fs.readFileSync(path.join(projectDir, "src/index.test.ts"), "utf8")).toContain(
      "getToolPluginMetadata",
    );
  });
});
