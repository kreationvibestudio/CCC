import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_PATH = join(ROOT, "secrets", "latest.env.local");

function parseEnvFile(envPath) {
  if (!existsSync(envPath)) return [];
  const entries = [];
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries.push({ name, value });
  }
  return entries;
}

function isPlaceholder(value) {
  if (!value || !value.trim()) return true;
  const t = value.trim();
  return t === "[SENSITIVE]" || /^your[_-]/i.test(t);
}

/** Load `.env.local` into process.env. Fills `[SENSITIVE]` from secrets/latest.env.local. */
export function loadEnvLocal() {
  const fromLocal = parseEnvFile(join(ROOT, ".env.local"));
  const fromBackup = parseEnvFile(BACKUP_PATH);
  const backupMap = new Map(fromBackup.map((e) => [e.name, e.value]));

  for (const { name, value } of fromLocal) {
    const resolved = isPlaceholder(value) && !isPlaceholder(backupMap.get(name) || "")
      ? backupMap.get(name)
      : value;
    if (!process.env[name] || isPlaceholder(process.env[name])) {
      if (resolved && !isPlaceholder(resolved)) process.env[name] = resolved;
      else if (!process.env[name]) process.env[name] = value;
    }
  }

  for (const { name, value } of fromBackup) {
    if ((!process.env[name] || isPlaceholder(process.env[name])) && !isPlaceholder(value)) {
      process.env[name] = value;
    }
  }
}
