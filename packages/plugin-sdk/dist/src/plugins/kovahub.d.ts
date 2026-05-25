import { type KovaHubPackageChannel, type KovaHubPackageFamily } from "../infra/kovahub.js";
import type { InstallSafetyOverrides } from "./install-security-scan.js";
import { type InstallPluginResult } from "./install.js";
export declare const KOVAHUB_INSTALL_ERROR_CODE: {
    readonly INVALID_SPEC: "invalid_spec";
    readonly PACKAGE_NOT_FOUND: "package_not_found";
    readonly VERSION_NOT_FOUND: "version_not_found";
    readonly NO_INSTALLABLE_VERSION: "no_installable_version";
    readonly SKILL_PACKAGE: "skill_package";
    readonly UNSUPPORTED_FAMILY: "unsupported_family";
    readonly PRIVATE_PACKAGE: "private_package";
    readonly INCOMPATIBLE_PLUGIN_API: "incompatible_plugin_api";
    readonly INCOMPATIBLE_GATEWAY: "incompatible_gateway";
    readonly MISSING_ARCHIVE_INTEGRITY: "missing_archive_integrity";
    readonly ARCHIVE_INTEGRITY_MISMATCH: "archive_integrity_mismatch";
};
export type KovaHubInstallErrorCode = (typeof KOVAHUB_INSTALL_ERROR_CODE)[keyof typeof KOVAHUB_INSTALL_ERROR_CODE];
type PluginInstallLogger = {
    info?: (message: string) => void;
    warn?: (message: string) => void;
};
export type KovaHubPluginInstallRecordFields = {
    source: "kovahub";
    kovahubUrl: string;
    kovahubPackage: string;
    kovahubFamily: Exclude<KovaHubPackageFamily, "skill">;
    kovahubChannel?: KovaHubPackageChannel;
    version?: string;
    integrity?: string;
    resolvedAt?: string;
    installedAt?: string;
};
type KovaHubInstallFailure = {
    ok: false;
    error: string;
    code?: KovaHubInstallErrorCode;
};
export declare function formatKovaHubSpecifier(params: {
    name: string;
    version?: string;
}): string;
export declare function installPluginFromKovaHub(params: InstallSafetyOverrides & {
    spec: string;
    baseUrl?: string;
    token?: string;
    logger?: PluginInstallLogger;
    mode?: "install" | "update";
    extensionsDir?: string;
    timeoutMs?: number;
    dryRun?: boolean;
    expectedPluginId?: string;
}): Promise<({
    ok: true;
} & Extract<InstallPluginResult, {
    ok: true;
}> & {
    kovahub: KovaHubPluginInstallRecordFields;
    packageName: string;
}) | KovaHubInstallFailure | Extract<InstallPluginResult, {
    ok: false;
}>>;
export {};
