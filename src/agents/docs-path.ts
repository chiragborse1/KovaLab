import fs from "node:fs";
import path from "node:path";
import { resolveKovaPackageRoot } from "../infra/kova-root.js";

export const KOVA_DOCS_URL = "https://docs.neuralstudio.in";
export const KOVA_SOURCE_URL = "https://github.com/chiragborse1/KovaLab";

type ResolveKovaReferencePathParams = {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
};

function isUsableDocsDir(docsDir: string): boolean {
  return fs.existsSync(path.join(docsDir, "docs.json"));
}

function isGitCheckout(rootDir: string): boolean {
  return fs.existsSync(path.join(rootDir, ".git"));
}

export async function resolveKovaDocsPath(params: {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
}): Promise<string | null> {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, "docs");
    if (isUsableDocsDir(workspaceDocs)) {
      return workspaceDocs;
    }
  }

  const packageRoot = await resolveKovaPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return null;
  }

  const packageDocs = path.join(packageRoot, "docs");
  return isUsableDocsDir(packageDocs) ? packageDocs : null;
}

export async function resolveKovaSourcePath(
  params: ResolveKovaReferencePathParams,
): Promise<string | null> {
  const packageRoot = await resolveKovaPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot || !isGitCheckout(packageRoot)) {
    return null;
  }
  return packageRoot;
}

export async function resolveKovaReferencePaths(params: ResolveKovaReferencePathParams): Promise<{
  docsPath: string | null;
  sourcePath: string | null;
}> {
  const [docsPath, sourcePath] = await Promise.all([
    resolveKovaDocsPath(params),
    resolveKovaSourcePath(params),
  ]);
  return { docsPath, sourcePath };
}
