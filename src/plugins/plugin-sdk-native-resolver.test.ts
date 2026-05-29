import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  installKovaPluginSdkNativeResolver,
  resetKovaPluginSdkNativeResolverForTest,
} from "./plugin-sdk-native-resolver.js";

afterEach(() => {
  resetKovaPluginSdkNativeResolverForTest();
});

function writeJsonFile(targetPath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeFakeKovaPackage(root: string): { distRoot: string; loaderModulePath: string } {
  writeJsonFile(path.join(root, "package.json"), {
    name: "getkova",
    type: "module",
    bin: {
      kova: "./kova.mjs",
    },
    exports: {
      "./cli-entry": "./dist/cli-entry.js",
      "./plugin-sdk": "./dist/plugin-sdk/root-alias.cjs",
      "./plugin-sdk/channel-outbound": "./dist/plugin-sdk/channel-outbound.js",
      "./plugin-sdk/source-only": "./dist/plugin-sdk/source-only.js",
    },
  });
  fs.writeFileSync(path.join(root, "kova.mjs"), "#!/usr/bin/env node\n", "utf8");
  const distRoot = path.join(root, "dist");
  const pluginSdkDir = path.join(distRoot, "plugin-sdk");
  fs.mkdirSync(pluginSdkDir, { recursive: true });
  fs.writeFileSync(path.join(pluginSdkDir, "root-alias.cjs"), "module.exports = {};\n", "utf8");
  fs.writeFileSync(
    path.join(pluginSdkDir, "channel-outbound.js"),
    ['export const defineChannelMessageAdapter = () => "adapter";', ""].join("\n"),
    "utf8",
  );
  const loaderModulePath = path.join(distRoot, "plugins", "loader.js");
  fs.mkdirSync(path.dirname(loaderModulePath), { recursive: true });
  fs.writeFileSync(loaderModulePath, "export default {};\n", "utf8");
  return { distRoot, loaderModulePath };
}

function writeExternalPluginEntry(root: string): string {
  writeJsonFile(path.join(root, "package.json"), {
    name: "external-plugin",
    type: "module",
  });
  const entry = path.join(root, "dist", "runtime-api.js");
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(entry, "export default {};\n", "utf8");
  return entry;
}

describe("installKovaPluginSdkNativeResolver", () => {
  it("keeps native aliases on JS dist artifacts when source files exist", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sdk-native-source-resolver-"));
    const { loaderModulePath } = writeFakeKovaPackage(root);
    const sourceChannelOutboundPath = path.join(root, "src", "plugin-sdk", "channel-outbound.ts");
    fs.mkdirSync(path.dirname(sourceChannelOutboundPath), { recursive: true });
    fs.writeFileSync(sourceChannelOutboundPath, "export const sourceOnly = true;\n", "utf8");
    const externalPluginEntry = writeExternalPluginEntry(path.join(root, "external-plugin"));

    const installedAliases = installKovaPluginSdkNativeResolver({
      modulePath: loaderModulePath,
      pluginModulePath: externalPluginEntry,
      pluginSdkResolution: "src",
    });

    expect(installedAliases).toContain("getkova/plugin-sdk/channel-outbound");
    expect(installedAliases).toContain("@getkova/plugin-sdk/channel-outbound");
    const requireFromPlugin = createRequire(externalPluginEntry);
    expect(fs.realpathSync(requireFromPlugin.resolve("getkova/plugin-sdk/channel-outbound"))).toBe(
      fs.realpathSync(path.join(root, "dist", "plugin-sdk", "channel-outbound.js")),
    );
  });

  it("lets built external plugins resolve Kova SDK subpaths with createRequire", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sdk-native-resolver-"));
    const { distRoot, loaderModulePath } = writeFakeKovaPackage(root);
    const externalPluginEntry = writeExternalPluginEntry(path.join(root, "external-plugin"));

    const distMode = fs.statSync(distRoot).mode;
    if (process.platform !== "win32") {
      fs.chmodSync(distRoot, 0o555);
    }

    try {
      const installedAliases = installKovaPluginSdkNativeResolver({
        modulePath: loaderModulePath,
        pluginModulePath: externalPluginEntry,
        pluginSdkResolution: "dist",
      });

      expect(installedAliases).toContain("getkova/plugin-sdk/channel-outbound");
      expect(fs.existsSync(path.join(distRoot, "extensions"))).toBe(false);
      const requireFromPlugin = createRequire(externalPluginEntry);
      expect(
        fs.realpathSync(requireFromPlugin.resolve("@getkova/plugin-sdk/channel-outbound")),
      ).toBe(fs.realpathSync(path.join(root, "dist", "plugin-sdk", "channel-outbound.js")));
      const sdk = requireFromPlugin("getkova/plugin-sdk/channel-outbound") as {
        defineChannelMessageAdapter?: () => string;
      };

      expect(sdk.defineChannelMessageAdapter?.()).toBe("adapter");
      expect(() => requireFromPlugin.resolve("getkova/not-plugin-sdk/channel-outbound")).toThrow();
    } finally {
      if (process.platform !== "win32") {
        fs.chmodSync(distRoot, distMode);
      }
    }
  });

  it("does not resolve SDK aliases for parents outside registered plugin roots", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sdk-native-guard-"));
    const { loaderModulePath } = writeFakeKovaPackage(root);
    const externalPluginEntry = writeExternalPluginEntry(path.join(root, "external-plugin"));
    const unrelatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kova-sdk-native-outside-"));
    const unrelatedEntry = path.join(unrelatedRoot, "runtime-api.js");
    fs.mkdirSync(path.dirname(unrelatedEntry), { recursive: true });
    fs.writeFileSync(unrelatedEntry, "export default {};\n", "utf8");

    installKovaPluginSdkNativeResolver({
      modulePath: loaderModulePath,
      pluginModulePath: externalPluginEntry,
      pluginSdkResolution: "dist",
    });

    const requireFromPlugin = createRequire(externalPluginEntry);
    const requireFromOutside = createRequire(unrelatedEntry);
    expect(requireFromPlugin.resolve("getkova/plugin-sdk/channel-outbound")).toBeTruthy();
    expect(() => requireFromOutside.resolve("getkova/plugin-sdk/channel-outbound")).toThrow();
  });
});
