import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function detectContentType(filePath: string): string {
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "text/html; charset=utf-8";
}

export function missingUiHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QA Lab UI Missing</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0f1115; color: #f5f7fb; margin: 0; display: grid; place-items: center; min-height: 100vh; }
      main { max-width: 42rem; padding: 2rem; background: #171b22; border: 1px solid #283140; border-radius: 18px; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #9ee8d8; }
      h1 { margin-top: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>QA Lab UI not built</h1>
      <p>Build the private debugger bundle, then reload this page.</p>
      <p><code>pnpm qa:lab:build</code></p>
    </main>
  </body>
</html>`;
}

export function resolveUiDistDir(overrideDir?: string | null, repoRoot = process.cwd()) {
  if (overrideDir?.trim()) {
    return overrideDir;
  }
  const candidates = [
    path.resolve(repoRoot, "extensions/qa-lab/web/dist"),
    path.resolve(repoRoot, "dist/extensions/qa-lab/web/dist"),
    fileURLToPath(new URL("../web/dist", import.meta.url)),
  ];
  return (
    candidates.find((candidate) => {
      if (!fs.existsSync(candidate)) {
        return false;
      }
      const indexPath = path.join(candidate, "index.html");
      return fs.existsSync(indexPath) && fs.statSync(indexPath).isFile();
    }) ?? candidates[0]
  );
}

function listUiAssetFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = fs
    .readdirSync(currentDir, { withFileTypes: true })
    .toSorted((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listUiAssetFiles(rootDir, resolved));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    files.push(path.relative(rootDir, resolved));
  }
  return files;
}

export function resolveUiAssetVersion(overrideDir?: string | null): string | null {
  try {
    const distDir = resolveUiDistDir(overrideDir);
    const indexPath = path.join(distDir, "index.html");
    if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) {
      return null;
    }
    const hash = createHash("sha1");
    for (const relativeFile of listUiAssetFiles(distDir)) {
      hash.update(relativeFile);
      hash.update("\0");
      hash.update(fs.readFileSync(path.join(distDir, relativeFile)));
      hash.update("\0");
    }
    return hash.digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

export function resolveAdvertisedBaseUrl(params: {
  bindHost?: string;
  bindPort: number;
  advertiseHost?: string;
  advertisePort?: number;
}) {
  const advertisedHost =
    params.advertiseHost?.trim() ||
    (params.bindHost && params.bindHost !== "0.0.0.0" ? params.bindHost : "127.0.0.1");
  const advertisedPort =
    typeof params.advertisePort === "number" && Number.isFinite(params.advertisePort)
      ? params.advertisePort
      : params.bindPort;
  return `http://${advertisedHost}:${advertisedPort}`;
}

export function tryResolveUiAsset(
  pathname: string,
  overrideDir?: string | null,
  repoRoot = process.cwd(),
): string | null {
  const distDir = resolveUiDistDir(overrideDir, repoRoot);
  if (!fs.existsSync(distDir)) {
    return null;
  }
  const safePath = pathname === "/" ? "/index.html" : pathname;
  let decoded: string;
  try {
    decoded = decodeURIComponent(safePath);
  } catch {
    return null;
  }
  const candidate = path.resolve(distDir, `.${decoded.startsWith("/") ? decoded : `/${decoded}`}`);
  const relative = path.relative(distDir, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }
  const fallback = path.join(distDir, "index.html");
  return fs.existsSync(fallback) ? fallback : null;
}
