#!/usr/bin/env node
/**
 * Fetch official INEC CVR GPS for Edo polling units.
 *
 * Only accepts real lat/lng redirects from cvr.inecnigeria.org — never Photon /
 * street-geocode fallbacks (those are kilometres off and break 100 ft check-in).
 *
 *   node scripts/fetch-edo-cvr-gps.mjs
 *   node scripts/fetch-edo-cvr-gps.mjs --limit=50
 *   node scripts/fetch-edo-cvr-gps.mjs --resume
 *   node scripts/fetch-edo-cvr-gps.mjs --missing-only --resume
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCvrClient, CVR_STATE_ID } from "../src/lib/polling-units/cvr-client.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../supabase/data/edo-polling-unit-gps.csv");
const REGISTER = path.join(__dirname, "../supabase/data/edo-polling-units.csv");
const PROGRESS = path.join(__dirname, "../supabase/data/.edo-cvr-gps-progress.json");

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : Infinity;
const resume = args.includes("--resume");
const missingOnly = args.includes("--missing-only");
const concurrency = Math.min(
  Math.max(Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 2), 1),
  4
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pad(code, width) {
  const digits = String(code || "").replace(/\D/g, "");
  return digits.padStart(width, "0").slice(-width);
}

function loadDoneCodes() {
  if (!fs.existsSync(OUT)) return new Set();
  const text = fs.readFileSync(OUT, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(1);
  const set = new Set();
  for (const line of lines) {
    const m = line.match(/,(\d{2}\/\d{2}\/\d{2}\/\d{3}),/);
    if (m) set.add(m[1]);
  }
  return set;
}

function loadRegisterCodes() {
  if (!fs.existsSync(REGISTER)) return null;
  const text = fs.readFileSync(REGISTER, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(1);
  const set = new Set();
  for (const line of lines) {
    const m = line.match(/,(\d{2}\/\d{2}\/\d{2}\/\d{3}),/);
    if (m) set.add(m[1]);
  }
  return set;
}

async function mapPool(items, width, fn) {
  let i = 0;
  const out = new Array(items.length);
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx], idx);
      await sleep(120);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const client = await createCvrClient({ delayMs: 60 });
  const done = resume ? loadDoneCodes() : new Set();
  const registerCodes = missingOnly ? loadRegisterCodes() : null;
  const header =
    "state_code,lg_code,ward_code,pu_code,code,name,ward,lga,latitude,longitude,cvr_pu_id\n";
  if (!resume || !fs.existsSync(OUT)) {
    fs.writeFileSync(OUT, header);
  }

  console.log(`Fetching Edo LGAs from INEC CVR… (concurrency=${concurrency}, strict lat/lng only)`);
  const lgas = await client.fetchOptions("lgas", "data[Search][state_id]", CVR_STATE_ID);
  console.log(`LGAs: ${lgas.length}; already have ${done.size} pins`);

  let written = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  for (const lga of lgas) {
    const lgCode = pad(lga.code, 2);
    const wards = await client.fetchOptions("wards", "data[Search][local_government_id]", lga.id);
    for (const ward of wards) {
      const wardCode = pad(ward.code, 2);
      const pus = await client.fetchOptions("pus", "data[Search][registration_area_id]", ward.id);
      const pending = pus
        .map((pu) => {
          const puCode = pad(pu.code, 3);
          const code = `${CVR_STATE_ID}/${lgCode}/${wardCode}/${puCode}`;
          return { ...pu, puCode, code };
        })
        .filter((pu) => {
          if (done.has(pu.code)) {
            skipped += 1;
            return false;
          }
          if (registerCodes && !registerCodes.has(pu.code)) return false;
          return true;
        });

      if (!pending.length) continue;
      if (written >= limit) break;

      const batch = pending.slice(0, Math.max(0, limit - written));
      const rows = await mapPool(batch, concurrency, async (pu) => {
        try {
          let pin;
          try {
            pin = await client.locate(lga.id, ward.id, pu.id);
          } catch (first) {
            await sleep(500);
            pin = await client.locate(lga.id, ward.id, pu.id);
          }
          if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude)) {
            throw new Error("Locator returned non-numeric coordinates");
          }
          if (pin.latitude < 4.15 || pin.latitude > 13.95 || pin.longitude < 2.55 || pin.longitude > 14.85) {
            throw new Error(`Locator outside Nigeria bbox: ${pin.latitude},${pin.longitude}`);
          }
          return {
            ok: true,
            line: [
              CVR_STATE_ID,
              lgCode,
              wardCode,
              pu.puCode,
              pu.code,
              pu.label,
              ward.label,
              lga.label,
              pin.latitude.toFixed(8),
              pin.longitude.toFixed(8),
              pu.id,
            ]
              .map(csvEscape)
              .join(","),
            code: pu.code,
          };
        } catch (e) {
          return { ok: false, code: pu.code, error: e instanceof Error ? e.message : String(e) };
        }
      });

      for (const row of rows) {
        if (!row) continue;
        if (row.ok) {
          fs.appendFileSync(OUT, `${row.line}\n`);
          done.add(row.code);
          written += 1;
        } else {
          failed += 1;
          failures.push(`${row.code}: ${row.error}`);
        }
      }
      console.log(
        `  ${lga.label} / ${ward.label}: batch ${batch.length} (written ${written}, failed ${failed})`
      );
      fs.writeFileSync(
        PROGRESS,
        JSON.stringify({ written, failed, skipped, at: new Date().toISOString(), out: OUT }, null, 2)
      );
      if (written >= limit) break;
    }
    if (written >= limit) break;
  }

  console.log(`Done. Wrote ${written} new pins → ${OUT}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures.slice(0, 30)) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
