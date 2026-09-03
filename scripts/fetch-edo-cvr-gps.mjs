#!/usr/bin/env node
/**
 * Fetch official INEC CVR GPS for every Edo polling unit and write a CSV.
 *
 * Source: https://cvr.inecnigeria.org/pu → PublicApi + /pu_locator/index
 * (Location header: https://maps.google.com/?q=lat,lng)
 *
 * Usage:
 *   node scripts/fetch-edo-cvr-gps.mjs
 *   node scripts/fetch-edo-cvr-gps.mjs --limit=50
 *   node scripts/fetch-edo-cvr-gps.mjs --resume
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../supabase/data/edo-polling-unit-gps.csv");
const PROGRESS = path.join(__dirname, "../supabase/data/.edo-cvr-gps-progress.json");
const BASE = "https://cvr.inecnigeria.org";
const STATE_ID = "12";
const UA =
  "CampaignCommandCenter/1.1 (Edo PU GPS sync; +https://github.com/kreationvibestudio/CCC)";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : Infinity;
const resume = args.includes("--resume");
const concurrency = Math.min(
  Math.max(Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? 3), 1),
  6
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseLabeled(value) {
  const raw = String(value ?? "").trim();
  const m = raw.match(/^(\d+)\s*-\s*(.+)$/);
  if (!m) return { code: "", label: raw };
  return { code: m[1], label: m[2].trim() };
}

function pad(code, width) {
  const digits = String(code || "").replace(/\D/g, "");
  return digits.padStart(width, "0").slice(-width);
}

async function withCookies() {
  const jar = new Map();
  async function request(url, init = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("User-Agent", UA);
    headers.set("Accept", "application/json,text/html,*/*");
    if (jar.size) {
      headers.set(
        "Cookie",
        [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ")
      );
    }
    const res = await fetch(url, { ...init, headers, redirect: "manual" });
    const setCookie = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
    for (const raw of setCookie) {
      const part = raw.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
    const single = res.headers.get("set-cookie");
    if (single && setCookie.length === 0) {
      const part = single.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
    return res;
  }
  await request(`${BASE}/pu`);
  return request;
}

async function fetchOptions(request, kind, parentKey, parentId) {
  const url = new URL(`${BASE}/PublicApi/${kind}/1/Search`);
  url.searchParams.set(parentKey, parentId);
  const res = await request(url);
  if (!res.ok) throw new Error(`${kind} HTTP ${res.status}`);
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return Object.entries(row || {})
    .filter(([k, v]) => k !== "0" && k !== "selected" && v)
    .map(([id, label]) => ({ id: String(id), ...parseLabeled(label) }));
}

async function geocodeTextQuery(query) {
  const url = new URL("https://photon.komoot.io/api");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "3");
  url.searchParams.set("lang", "en");
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const features = data?.features ?? [];
  for (const f of features) {
    const [lng, lat] = f?.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 4.15 || lat > 13.95 || lng < 2.55 || lng > 14.85) continue;
    const label = String(f?.properties?.name || f?.properties?.city || "");
    return { latitude: lat, longitude: lng, mapsUrl: `geocode:${query}`, label };
  }
  return null;
}

async function locate(request, lgaId, wardId, puId) {
  const body = new URLSearchParams({
    _method: "POST",
    "data[Search][state_id]": STATE_ID,
    "data[Search][local_government_id]": lgaId,
    "data[Search][registration_area_id]": wardId,
    "data[Search][polling_unit_id]": puId,
  });
  const res = await request(`${BASE}/pu_locator/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${BASE}/pu`,
    },
    body,
  });
  const location = res.headers.get("location") || "";
  const coords = location.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (coords) {
    return { latitude: Number(coords[1]), longitude: Number(coords[2]), mapsUrl: location };
  }
  const text = location.match(/[?&]q=([^&]+)/);
  if (text) {
    const query = decodeURIComponent(text[1].replace(/\+/g, " "));
    const hit = await geocodeTextQuery(`${query}, Nigeria`);
    if (hit) return hit;
    throw new Error(`Text locator could not geocode: ${query.slice(0, 100)}`);
  }
  throw new Error(`No lat/lng in locator redirect (${res.status}): ${location.slice(0, 120)}`);
}

async function mapPool(items, width, fn) {
  let i = 0;
  const out = new Array(items.length);
  const workers = Array.from({ length: Math.min(width, items.length) }, async () => {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx], idx);
      await sleep(80);
    }
  });
  await Promise.all(workers);
  return out;
}

function loadDoneCodes() {
  if (!resume || !fs.existsSync(OUT)) return new Set();
  const text = fs.readFileSync(OUT, "utf8");
  const lines = text.trim().split(/\r?\n/).slice(1);
  const set = new Set();
  for (const line of lines) {
    const cols = line.split(",");
    // code is 5th column when unquoted; fall back to regex
    const m = line.match(/,(\d{2}\/\d{2}\/\d{2}\/\d{3}),/);
    if (m) set.add(m[1]);
    else if (cols[4] && /^\d{2}\/\d{2}\/\d{2}\/\d{3}$/.test(cols[4])) set.add(cols[4]);
  }
  return set;
}

async function main() {
  const request = await withCookies();
  const done = loadDoneCodes();
  const header =
    "state_code,lg_code,ward_code,pu_code,code,name,ward,lga,latitude,longitude,cvr_pu_id\n";
  if (!resume || !fs.existsSync(OUT)) {
    fs.writeFileSync(OUT, header);
  }

  console.log(`Fetching Edo LGAs from INEC CVR… (concurrency=${concurrency})`);
  const lgas = await fetchOptions(request, "lgas", "data[Search][state_id]", STATE_ID);
  console.log(`LGAs: ${lgas.length}`);

  let written = 0;
  let failed = 0;
  const failures = [];

  for (const lga of lgas) {
    const lgCode = pad(lga.code, 2);
    const wards = await fetchOptions(
      request,
      "wards",
      "data[Search][local_government_id]",
      lga.id
    );
    for (const ward of wards) {
      const wardCode = pad(ward.code, 2);
      const pus = await fetchOptions(
        request,
        "pus",
        "data[Search][registration_area_id]",
        ward.id
      );
      const pending = pus
        .map((pu) => {
          const puCode = pad(pu.code, 3);
          const code = `${STATE_ID}/${lgCode}/${wardCode}/${puCode}`;
          return { ...pu, puCode, code };
        })
        .filter((pu) => !done.has(pu.code));

      if (!pending.length) continue;
      if (written >= limit) break;

      const batch = pending.slice(0, Math.max(0, limit - written));
      const rows = await mapPool(batch, concurrency, async (pu) => {
        try {
          let pin;
          try {
            pin = await locate(request, lga.id, ward.id, pu.id);
          } catch (first) {
            await sleep(400);
            pin = await locate(request, lga.id, ward.id, pu.id);
          }
          return {
            ok: true,
            line: [
              STATE_ID,
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
        `  ${lga.label} / ${ward.label}: +${batch.length} (written ${written}, failed ${failed})`
      );
      fs.writeFileSync(
        PROGRESS,
        JSON.stringify({ written, failed, at: new Date().toISOString(), out: OUT }, null, 2)
      );
      if (written >= limit) break;
    }
    if (written >= limit) break;
  }

  console.log(`Done. Wrote ${written} pins → ${OUT}`);
  if (failures.length) {
    console.log(`Failures (${failures.length}):`);
    for (const f of failures.slice(0, 20)) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
