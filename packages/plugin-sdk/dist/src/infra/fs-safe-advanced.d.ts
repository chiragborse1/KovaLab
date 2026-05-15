export type AssertNoSymlinkParentsOptions = {
    rootDir: string;
    targetPath: string;
    allowOutsideRoot?: boolean;
    messagePrefix?: string;
};
export declare function assertNoSymlinkParentsSync(opts: AssertNoSymlinkParentsOptions): void;
