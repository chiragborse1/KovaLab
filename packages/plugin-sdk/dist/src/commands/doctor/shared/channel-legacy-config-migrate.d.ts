export declare function applyChannelDoctorCompatibilityMigrations(cfg: Record<string, unknown>, options?: {
    pluginFallback?: "full" | "skip";
}): {
    next: Record<string, unknown>;
    changes: string[];
};
