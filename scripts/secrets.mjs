#!/usr/bin/env node
/**
 * Secret management for CCC — local backup + optional GitHub/Vercel sync.
 *
 * Usage:
 *   node scripts/secrets.mjs backup          # .env.local → secrets/ (gitignored)
 *   node scripts/secrets.mjs restore         # secrets/latest.env.local → .env.local
 *   node scripts/secrets.mjs github          # push keys to GitHub repo secrets (one-way)
 *   node scripts/secrets.mjs vercel-pull     # pull production env from Vercel
 *   node scripts/secrets.mjs list            # show which keys are set (no values)
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { execSync, spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");
const SECRETS_DIR = join(ROOT, "secrets");
const LATEST_BACKUP = join(SECRETS_DIR, "latest.env.local");

/** Keys we manage — skip Vercel OIDC (short-lived) and comments */
const SKIP_KEYS = new Set(["VERCEL_OIDC_TOKEN"]);

function parseEnv(content) {
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!SKIP_KEYS.has(key)) entries.push({ key, value });
  }
  return entries;
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    console.error(`Missing file: ${path}`);
    process.exit(1);
  }
  return parseEnv(readFileSync(path, "utf8"));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function backup() {
  if (!existsSync(ENV_FILE)) {
    console.error("No .env.local found. Create it from .env.example first.");
    process.exit(1);
  }
  mkdirSync(SECRETS_DIR, { recursive: true });
  const stamped = join(SECRETS_DIR, `env-${timestamp()}.local`);
  copyFileSync(ENV_FILE, stamped);
  copyFileSync(ENV_FILE, LATEST_BACKUP);
  console.log(`✓ Backed up to secrets/latest.env.local`);
  console.log(`✓ Archive: ${stamped.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
  list(true);
}

function restore() {
  if (!existsSync(LATEST_BACKUP)) {
    const archives = existsSync(SECRETS_DIR)
      ? readdirSync(SECRETS_DIR).filter((f) => f.startsWith("env-") && f.endsWith(".local")).sort().reverse()
      : [];
    if (archives.length === 0) {
      console.error("No backup found. Run: npm run secrets:backup");
      process.exit(1);
    }
    copyFileSync(join(SECRETS_DIR, archives[0]), ENV_FILE);
    console.log(`✓ Restored from secrets/${archives[0]}`);
    return;
  }
  copyFileSync(LATEST_BACKUP, ENV_FILE);
  console.log("✓ Restored secrets/latest.env.local → .env.local");
}

function hasGh() {
  try {
    execSync("gh --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function github() {
  if (!hasGh()) {
    console.error("GitHub CLI (gh) not installed. Install from https://cli.github.com/");
    process.exit(1);
  }
  const entries = readEnvFile(existsSync(ENV_FILE) ? ENV_FILE : LATEST_BACKUP);
  console.log(`Pushing ${entries.length} secrets to GitHub (kreationvibestudio/CCC)…`);
  console.log("(GitHub stores these one-way — you cannot read values back, only overwrite.)\n");

  for (const { key, value } of entries) {
    if (!value || value.includes("your-") || value === "") continue;
    const result = spawnSync("gh", ["secret", "set", key, "--repo", "kreationvibestudio/CCC"], {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.status === 0) {
      console.log(`  ✓ ${key}`);
    } else {
      console.error(`  ✗ ${key}: ${result.stderr?.toString() || "failed"}`);
    }
  }
  console.log("\nDone. GitHub → Settings → Secrets and variables → Actions");
}

function vercelPull() {
  try {
    const previous = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, "utf8")) : [];
    const previousMap = new Map(previous.map((e) => [e.key, e.value]));

    execSync("npx vercel env pull .env.local --yes", { cwd: ROOT, stdio: "inherit" });

    // Vercel redacts Sensitive values as [SENSITIVE] on pull — keep prior real secrets.
    if (existsSync(ENV_FILE)) {
      const pulled = parseEnv(readFileSync(ENV_FILE, "utf8"));
      const restored = [];
      const lines = readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
      const nextLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        const eq = trimmed.indexOf("=");
        if (eq === -1) return line;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (!value || value === "[SENSITIVE]" || /^your[_-]/i.test(value)) &&
          previousMap.get(key) &&
          previousMap.get(key) !== "[SENSITIVE]" &&
          !/^your[_-]/i.test(previousMap.get(key) || "")
        ) {
          restored.push(key);
          return `${key}=${previousMap.get(key)}`;
        }
        return line;
      });
      if (restored.length) {
        writeFileSync(ENV_FILE, nextLines.join("\n").replace(/\n*$/, "\n"));
        console.log(`✓ Preserved ${restored.length} local secret(s) that Vercel redacted: ${restored.join(", ")}`);
      }
      // silence unused
      void pulled;
    }

    console.log("✓ Pulled Vercel env vars into .env.local");
    backup();
  } catch {
    console.error("Run `npx vercel login` and `npx vercel link` first.");
    process.exit(1);
  }
}

function list(fromBackup = false) {
  const path = fromBackup && existsSync(LATEST_BACKUP) ? LATEST_BACKUP : ENV_FILE;
  if (!existsSync(path)) {
    console.log("No .env.local");
    return;
  }
  const entries = readEnvFile(path);
  console.log("\nConfigured keys:");
  for (const { key, value } of entries) {
    let status = "empty";
    if (value && value.trim() && value.trim() !== "[SENSITIVE]" && !/^your[_-]/i.test(value) && !value.includes("your-")) {
      status = "set";
    } else if (value?.trim() === "[SENSITIVE]") {
      status = "redacted — paste the real value from the Vercel dashboard";
    }
    console.log(`  ${key}: ${status}`);
  }
}

const cmd = process.argv[2] ?? "help";
switch (cmd) {
  case "backup":
    backup();
    break;
  case "restore":
    restore();
    break;
  case "github":
    github();
    break;
  case "vercel-pull":
    vercelPull();
    break;
  case "list":
    list();
    break;
  default:
    console.log(`Secret management — npm run secrets:<command>

  backup       Save .env.local to secrets/ (gitignored, local disk)
  restore      Restore .env.local from latest backup
  github       Push secrets to GitHub repo (Actions secrets, one-way)
  vercel-pull  Download env from Vercel + auto-backup
  list         Show configured keys (no values)`);
}
