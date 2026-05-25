export type InstallRecordBase = {
    source: "npm" | "archive" | "path" | "kovahub";
    spec?: string;
    sourcePath?: string;
    installPath?: string;
    version?: string;
    resolvedName?: string;
    resolvedVersion?: string;
    resolvedSpec?: string;
    integrity?: string;
    shasum?: string;
    resolvedAt?: string;
    installedAt?: string;
    kovahubUrl?: string;
    kovahubPackage?: string;
    kovahubFamily?: "code-plugin" | "bundle-plugin";
    kovahubChannel?: "official" | "community" | "private";
};
