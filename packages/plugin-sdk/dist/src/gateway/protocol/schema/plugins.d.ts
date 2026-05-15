import { Type } from "typebox";
export declare const PluginsStatusParamsSchema: Type.TObject<{}>;
export declare const PluginsSetEnabledParamsSchema: Type.TObject<{
    pluginId: Type.TString;
    enabled: Type.TBoolean;
}>;
export declare const PluginsUninstallParamsSchema: Type.TObject<{
    pluginId: Type.TString;
    deleteFiles: Type.TOptional<Type.TBoolean>;
}>;
export declare const PluginsInstallParamsSchema: Type.TObject<{
    spec: Type.TString;
    force: Type.TOptional<Type.TBoolean>;
    pin: Type.TOptional<Type.TBoolean>;
    dangerouslyForceUnsafeInstall: Type.TOptional<Type.TBoolean>;
}>;
export declare const PluginStatusSummarySchema: Type.TObject<{
    id: Type.TString;
    name: Type.TString;
    enabled: Type.TBoolean;
    status: Type.TUnion<[Type.TLiteral<"loaded">, Type.TLiteral<"disabled">, Type.TLiteral<"error">]>;
    origin: Type.TString;
    format: Type.TOptional<Type.TString>;
    bundleFormat: Type.TOptional<Type.TString>;
    kind: Type.TOptional<Type.TUnion<[Type.TString, Type.TArray<Type.TString>]>>;
    version: Type.TOptional<Type.TString>;
    description: Type.TOptional<Type.TString>;
    channelIds: Type.TArray<Type.TString>;
    providerIds: Type.TArray<Type.TString>;
    toolNames: Type.TArray<Type.TString>;
    gatewayMethods: Type.TArray<Type.TString>;
    services: Type.TArray<Type.TString>;
    commands: Type.TArray<Type.TString>;
    configSchema: Type.TBoolean;
    installed: Type.TBoolean;
    configured: Type.TBoolean;
    removable: Type.TBoolean;
    error: Type.TOptional<Type.TString>;
}>;
export declare const PluginStatusDiagnosticSchema: Type.TObject<{
    level: Type.TUnion<[Type.TLiteral<"info">, Type.TLiteral<"warn">, Type.TLiteral<"error">]>;
    message: Type.TString;
    code: Type.TOptional<Type.TString>;
    pluginId: Type.TOptional<Type.TString>;
    source: Type.TOptional<Type.TString>;
}>;
export declare const PluginsStatusResultSchema: Type.TObject<{
    registrySource: Type.TUnion<[Type.TLiteral<"provided">, Type.TLiteral<"persisted">, Type.TLiteral<"derived">]>;
    plugins: Type.TArray<Type.TObject<{
        id: Type.TString;
        name: Type.TString;
        enabled: Type.TBoolean;
        status: Type.TUnion<[Type.TLiteral<"loaded">, Type.TLiteral<"disabled">, Type.TLiteral<"error">]>;
        origin: Type.TString;
        format: Type.TOptional<Type.TString>;
        bundleFormat: Type.TOptional<Type.TString>;
        kind: Type.TOptional<Type.TUnion<[Type.TString, Type.TArray<Type.TString>]>>;
        version: Type.TOptional<Type.TString>;
        description: Type.TOptional<Type.TString>;
        channelIds: Type.TArray<Type.TString>;
        providerIds: Type.TArray<Type.TString>;
        toolNames: Type.TArray<Type.TString>;
        gatewayMethods: Type.TArray<Type.TString>;
        services: Type.TArray<Type.TString>;
        commands: Type.TArray<Type.TString>;
        configSchema: Type.TBoolean;
        installed: Type.TBoolean;
        configured: Type.TBoolean;
        removable: Type.TBoolean;
        error: Type.TOptional<Type.TString>;
    }>>;
    diagnostics: Type.TArray<Type.TObject<{
        level: Type.TUnion<[Type.TLiteral<"info">, Type.TLiteral<"warn">, Type.TLiteral<"error">]>;
        message: Type.TString;
        code: Type.TOptional<Type.TString>;
        pluginId: Type.TOptional<Type.TString>;
        source: Type.TOptional<Type.TString>;
    }>>;
    totals: Type.TObject<{
        total: Type.TInteger;
        enabled: Type.TInteger;
        disabled: Type.TInteger;
        errors: Type.TInteger;
        channels: Type.TInteger;
        providers: Type.TInteger;
    }>;
}>;
export declare const PluginsMutationResultSchema: Type.TObject<{
    ok: Type.TBoolean;
    pluginId: Type.TString;
    message: Type.TString;
    restartRequired: Type.TBoolean;
    warnings: Type.TArray<Type.TString>;
    status: Type.TObject<{
        registrySource: Type.TUnion<[Type.TLiteral<"provided">, Type.TLiteral<"persisted">, Type.TLiteral<"derived">]>;
        plugins: Type.TArray<Type.TObject<{
            id: Type.TString;
            name: Type.TString;
            enabled: Type.TBoolean;
            status: Type.TUnion<[Type.TLiteral<"loaded">, Type.TLiteral<"disabled">, Type.TLiteral<"error">]>;
            origin: Type.TString;
            format: Type.TOptional<Type.TString>;
            bundleFormat: Type.TOptional<Type.TString>;
            kind: Type.TOptional<Type.TUnion<[Type.TString, Type.TArray<Type.TString>]>>;
            version: Type.TOptional<Type.TString>;
            description: Type.TOptional<Type.TString>;
            channelIds: Type.TArray<Type.TString>;
            providerIds: Type.TArray<Type.TString>;
            toolNames: Type.TArray<Type.TString>;
            gatewayMethods: Type.TArray<Type.TString>;
            services: Type.TArray<Type.TString>;
            commands: Type.TArray<Type.TString>;
            configSchema: Type.TBoolean;
            installed: Type.TBoolean;
            configured: Type.TBoolean;
            removable: Type.TBoolean;
            error: Type.TOptional<Type.TString>;
        }>>;
        diagnostics: Type.TArray<Type.TObject<{
            level: Type.TUnion<[Type.TLiteral<"info">, Type.TLiteral<"warn">, Type.TLiteral<"error">]>;
            message: Type.TString;
            code: Type.TOptional<Type.TString>;
            pluginId: Type.TOptional<Type.TString>;
            source: Type.TOptional<Type.TString>;
        }>>;
        totals: Type.TObject<{
            total: Type.TInteger;
            enabled: Type.TInteger;
            disabled: Type.TInteger;
            errors: Type.TInteger;
            channels: Type.TInteger;
            providers: Type.TInteger;
        }>;
    }>;
}>;
export declare const PluginsInstallResultSchema: Type.TObject<{
    ok: Type.TBoolean;
    pluginId: Type.TString;
    message: Type.TString;
    restartRequired: Type.TBoolean;
    logs: Type.TArray<Type.TString>;
    status: Type.TObject<{
        registrySource: Type.TUnion<[Type.TLiteral<"provided">, Type.TLiteral<"persisted">, Type.TLiteral<"derived">]>;
        plugins: Type.TArray<Type.TObject<{
            id: Type.TString;
            name: Type.TString;
            enabled: Type.TBoolean;
            status: Type.TUnion<[Type.TLiteral<"loaded">, Type.TLiteral<"disabled">, Type.TLiteral<"error">]>;
            origin: Type.TString;
            format: Type.TOptional<Type.TString>;
            bundleFormat: Type.TOptional<Type.TString>;
            kind: Type.TOptional<Type.TUnion<[Type.TString, Type.TArray<Type.TString>]>>;
            version: Type.TOptional<Type.TString>;
            description: Type.TOptional<Type.TString>;
            channelIds: Type.TArray<Type.TString>;
            providerIds: Type.TArray<Type.TString>;
            toolNames: Type.TArray<Type.TString>;
            gatewayMethods: Type.TArray<Type.TString>;
            services: Type.TArray<Type.TString>;
            commands: Type.TArray<Type.TString>;
            configSchema: Type.TBoolean;
            installed: Type.TBoolean;
            configured: Type.TBoolean;
            removable: Type.TBoolean;
            error: Type.TOptional<Type.TString>;
        }>>;
        diagnostics: Type.TArray<Type.TObject<{
            level: Type.TUnion<[Type.TLiteral<"info">, Type.TLiteral<"warn">, Type.TLiteral<"error">]>;
            message: Type.TString;
            code: Type.TOptional<Type.TString>;
            pluginId: Type.TOptional<Type.TString>;
            source: Type.TOptional<Type.TString>;
        }>>;
        totals: Type.TObject<{
            total: Type.TInteger;
            enabled: Type.TInteger;
            disabled: Type.TInteger;
            errors: Type.TInteger;
            channels: Type.TInteger;
            providers: Type.TInteger;
        }>;
    }>;
}>;
