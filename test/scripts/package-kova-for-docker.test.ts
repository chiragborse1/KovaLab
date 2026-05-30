import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { packKovaPackageForDocker } from "../../scripts/package-kova-for-docker.mjs";

const roots: string[] = [];

function makeRoot(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("packKovaPackageForDocker", () => {
  it("prepares and restores changelog notes around npm pack", async () => {
    const sourceDir = makeRoot("kova-docker-package-source-");
    const outputDir = makeRoot("kova-docker-package-output-");
    const calls: string[] = [];

    const tarball = await packKovaPackageForDocker(sourceDir, outputDir, {
      prepareChangelog: async (cwd: string) => {
        calls.push(`prepare:${cwd}`);
      },
      restoreChangelog: async (cwd: string) => {
        calls.push(`restore:${cwd}`);
      },
      runCaptureImpl: async (command: string, args: string[], cwd: string) => {
        calls.push(`${command}:${args.join(" ")}:${cwd}`);
        return "getkova-2.0.0.tgz\n";
      },
    });

    expect(tarball).toBe(path.join(outputDir, "getkova-2.0.0.tgz"));
    expect(calls).toEqual([
      `prepare:${sourceDir}`,
      `npm:pack --silent --ignore-scripts --pack-destination ${outputDir}:${sourceDir}`,
      `restore:${sourceDir}`,
    ]);
  });

  it("restores changelog notes when npm pack fails", async () => {
    const sourceDir = makeRoot("kova-docker-package-source-");
    const outputDir = makeRoot("kova-docker-package-output-");
    const calls: string[] = [];

    await expect(
      packKovaPackageForDocker(sourceDir, outputDir, {
        prepareChangelog: async (cwd: string) => {
          calls.push(`prepare:${cwd}`);
        },
        restoreChangelog: async (cwd: string) => {
          calls.push(`restore:${cwd}`);
        },
        runCaptureImpl: async () => {
          calls.push("pack");
          throw new Error("pack failed");
        },
      }),
    ).rejects.toThrow("pack failed");

    expect(calls).toEqual([`prepare:${sourceDir}`, "pack", `restore:${sourceDir}`]);
  });
});
