import { Type } from "typebox";
import { NonEmptyString } from "./primitives.js";

export const PluginsStatusParamsSchema = Type.Object({}, { additionalProperties: false });

export const PluginsSetEnabledParamsSchema = Type.Object(
  {
    pluginId: NonEmptyString,
    enabled: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const PluginsUninstallParamsSchema = Type.Object(
  {
    pluginId: NonEmptyString,
    deleteFiles: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const PluginsInstallParamsSchema = Type.Object(
  {
    spec: NonEmptyString,
    force: Type.Optional(Type.Boolean()),
    pin: Type.Optional(Type.Boolean()),
    dangerouslyForceUnsafeInstall: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const PluginStatusSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    enabled: Type.Boolean(),
    status: Type.Union([Type.Literal("loaded"), Type.Literal("disabled"), Type.Literal("error")]),
    origin: Type.String(),
    format: Type.String(),
    bundleFormat: Type.Optional(Type.String()),
    kind: Type.Optional(Type.String()),
    version: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    channelIds: Type.Array(Type.String()),
    providerIds: Type.Array(Type.String()),
    toolNames: Type.Array(Type.String()),
    gatewayMethods: Type.Array(Type.String()),
    services: Type.Array(Type.String()),
    commands: Type.Array(Type.String()),
    configSchema: Type.Boolean(),
    installed: Type.Boolean(),
    configured: Type.Boolean(),
    removable: Type.Boolean(),
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const PluginStatusDiagnosticSchema = Type.Object(
  {
    level: Type.Union([Type.Literal("info"), Type.Literal("warn"), Type.Literal("error")]),
    message: Type.String(),
    code: Type.Optional(Type.String()),
    pluginId: Type.Optional(Type.String()),
    source: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const PluginsStatusResultSchema = Type.Object(
  {
    registrySource: Type.Union([
      Type.Literal("provided"),
      Type.Literal("persisted"),
      Type.Literal("derived"),
    ]),
    plugins: Type.Array(PluginStatusSummarySchema),
    diagnostics: Type.Array(PluginStatusDiagnosticSchema),
    totals: Type.Object(
      {
        total: Type.Integer({ minimum: 0 }),
        enabled: Type.Integer({ minimum: 0 }),
        disabled: Type.Integer({ minimum: 0 }),
        errors: Type.Integer({ minimum: 0 }),
        channels: Type.Integer({ minimum: 0 }),
        providers: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const PluginsMutationResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    pluginId: NonEmptyString,
    message: Type.String(),
    restartRequired: Type.Boolean(),
    warnings: Type.Array(Type.String()),
    status: PluginsStatusResultSchema,
  },
  { additionalProperties: false },
);

export const PluginsInstallResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    pluginId: NonEmptyString,
    message: Type.String(),
    restartRequired: Type.Boolean(),
    logs: Type.Array(Type.String()),
    status: PluginsStatusResultSchema,
  },
  { additionalProperties: false },
);
