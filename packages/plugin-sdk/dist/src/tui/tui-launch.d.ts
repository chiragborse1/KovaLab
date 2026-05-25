import type { TuiOptions } from "./tui.js";
type TuiLaunchOptions = {
    authSource?: "config";
    gatewayUrl?: string;
};
export declare function filterTuiExecArgv(execArgv: readonly string[]): string[];
export declare function launchTuiCli(opts: TuiOptions, launchOptions?: TuiLaunchOptions): Promise<void>;
export {};
