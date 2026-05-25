export declare function applyRuntimeLegacyConfigMigrations(raw: unknown, options?: {
    pluginFallback?: "full" | "skip";
}): {
    next: Record<string, unknown> | null;
    changes: string[];
};
