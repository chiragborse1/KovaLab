import { z } from "zod";

export const InstallSourceSchema = z.union([
  z.literal("npm"),
  z.literal("archive"),
  z.literal("path"),
  z.literal("kovahub"),
]);

export const PluginInstallSourceSchema = z.union([InstallSourceSchema, z.literal("marketplace")]);

export const InstallRecordShape = {
  source: InstallSourceSchema,
  spec: z.string().optional(),
  sourcePath: z.string().optional(),
  installPath: z.string().optional(),
  version: z.string().optional(),
  resolvedName: z.string().optional(),
  resolvedVersion: z.string().optional(),
  resolvedSpec: z.string().optional(),
  integrity: z.string().optional(),
  shasum: z.string().optional(),
  resolvedAt: z.string().optional(),
  installedAt: z.string().optional(),
  kovahubUrl: z.string().optional(),
  kovahubPackage: z.string().optional(),
  kovahubFamily: z.union([z.literal("code-plugin"), z.literal("bundle-plugin")]).optional(),
  kovahubChannel: z
    .union([z.literal("official"), z.literal("community"), z.literal("private")])
    .optional(),
} as const;

export const PluginInstallRecordShape = {
  ...InstallRecordShape,
  source: PluginInstallSourceSchema,
  marketplaceName: z.string().optional(),
  marketplaceSource: z.string().optional(),
  marketplacePlugin: z.string().optional(),
} as const;
