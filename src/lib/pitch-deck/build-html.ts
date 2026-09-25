import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export function pitchDeckSourceDir(cwd = process.cwd()): string {
  return path.join(cwd, "docs", "sales");
}

function dataUriForAsset(assetsDir: string, relativePath: string): string {
  const cleaned = relativePath.replace(/^\.\//, "").replace(/^pitch-assets\//, "");
  const filePath = path.join(assetsDir, cleaned);
  if (!existsSync(filePath)) {
    throw new Error(`Missing pitch asset: ${relativePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const buf = readFileSync(filePath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

/**
 * Build a self-contained pitch HTML so Print / Download always include images,
 * even offline or as a saved file.
 */
export function buildSelfContainedPitchHtml(cwd = process.cwd()): string {
  const root = pitchDeckSourceDir(cwd);
  const htmlPath = path.join(root, "ccc-pitch-deck.html");
  const assetsDir = path.join(root, "pitch-assets");
  if (!existsSync(htmlPath)) {
    throw new Error("Pitch deck HTML not found under docs/sales/");
  }

  let html = readFileSync(htmlPath, "utf8");
  const cache = new Map<string, string>();

  const uriFor = (rel: string) => {
    const key = rel.replace(/^\.\//, "");
    let uri = cache.get(key);
    if (!uri) {
      uri = dataUriForAsset(assetsDir, key);
      cache.set(key, uri);
    }
    return uri;
  };

  // src="./pitch-assets/..."
  html = html.replace(
    /src=(["'])\.\/pitch-assets\/([^"']+)\1/g,
    (_m, q: string, file: string) => `src=${q}${uriFor(`pitch-assets/${file}`)}${q}`
  );

  // url('./pitch-assets/...') or url("./pitch-assets/...")
  html = html.replace(
    /url\((["']?)\.\/pitch-assets\/([^"')]+)\1\)/g,
    (_m, _q: string, file: string) => `url(${uriFor(`pitch-assets/${file}`)})`
  );

  return html;
}
