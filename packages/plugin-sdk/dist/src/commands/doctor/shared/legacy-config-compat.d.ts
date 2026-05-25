export declare function applyLegacyDoctorMigrations(raw: unknown, options?: {
    pluginFallback?: "full" | "skip";
}): {
    next: Record<string, unknown> | null;
    changes: string[];
};
