# Polling unit import (Edo State — INEC format)

## Full Edo dataset

`supabase/data/edo-polling-units.csv` contains **all 18 LGAs / 4,711 polling units** for Edo State (source: INEC public polling-unit directory via JayCodist scraper snapshot, Sep 2025).

Includes **Edo Central** senatorial LGAs:

| LGA | PUs |
|-----|-----|
| Esan Central | 127 |
| Esan North-East | 183 |
| Esan South-East | 170 |
| Esan West | 210 |
| Igueben | 105 |
| **Edo Central total** | **795** |

`edo-esan-polling-units.csv` remains a tiny sample for docs/demos only.

The full polling unit code is **STATE/LGA/WARD/PU**, padded, for example:

- `EDO/ESAN-WEST/01/001` — Edo, Esan West, ward 01, unit 001
- `12/03/01/001` — the same unit in INEC’s numeric delimitation form (state 12)

HQ stores and shows the campaign form (`EDO/…`). Ward and PU are two- and three-digit INEC serials.

Polling Units → **Format PU codes** rewrites existing rows. Import also formats on the way in.

## Load the official Edo INEC register

HQ is confined to **Edo State**. Search, assign, maps, and Field Agent lookup only return Edo units (`EDO/…` or INEC `12/…`).

Polling Units → **Load Edo INEC PUs** downloads INEC’s Edo directory and **removes units from every other state**. Production also needs these SQL files applied once (or `npm run cloud:setup`):

- `supabase/migrations/20260824000000_edo_only_polling_units.sql`
- `supabase/migrations/20260824000001_prune_non_edo_polling_units.sql`

CLI (uses `.env.local` — local DB unless that file points at production):

```bash
npm run pu:bootstrap   # import Edo CSV + approximate LGA map pins for agent check-in
npm run pu:sync-inec
```

Field Agent check-in uses a **5 km** radius around the stored pin. GPS is preferred; when location is unavailable, soft check-in (`AGENT_LOGIN_SOFT_GPS=true`) still allows the agent code. Web login: `/agent/login`.

## Official INEC CSV columns

```csv
state,lg,ward,state_code,lg_code,ward_code,pu_code,code,location,ward_des,lg_des
EDO,03,01,12,03,01,001,12/03/01/001,IBORE PRIMARY SCHOOL , IBORE-I,Uneah,Esan Central
```

| INEC column | Stored as | Notes |
|-------------|-----------|--------|
| `state` | `state` | State name (e.g. EDO) |
| `lg` | `lg_code` (fallback) | LGA index/code |
| `ward` | `ward_code` (fallback) | Ward index |
| `state_code` | `state_code` | INEC state code (`12` for Edo) |
| `lg_code` | `lg_code` | INEC LGA code |
| `ward_code` | `ward_code` | INEC ward code |
| `pu_code` | `pu_code` | INEC PU serial |
| `code` | `code` | Full PU code (unique key) |
| `location` | `name` + `address` | Polling unit location |
| `ward_des` | `ward` | Ward description |
| `lg_des` | `lga` | LGA description |

If `code` is missing, it is built from `state_code/lg_code/ward_code/pu_code`.

Legacy simplified CSV (`code,name,ward,lga,...`) is still supported.

## Import via UI

Polling Units → **Import CSV** (batched; works with large INEC files). Upload `supabase/data/edo-polling-units.csv`.

## Import via CLI

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`:

```bash
npm run pu:import
# or explicit path:
npm run pu:import -- supabase/data/edo-polling-units.csv
```

To fill map pins after import, see below.

## Fill missing map pins (latitude / longitude)

INEC’s public CSV has **names, not GPS**. The map used to drop **approximate LGA-centroid pins** (jittered) so Field Agent check-in could work — those do **not** sit on the real buildings.

### Align to official INEC CVR GPS (recommended)

Pull coordinates from the INEC Continuous Voter Registration locator (`cvr.inecnigeria.org`) and write them into `polling_units`:

```bash
npm run pu:fetch-gps            # scrape Edo → supabase/data/edo-polling-unit-gps.csv
npm run pu:fetch-gps -- --resume
npm run pu:apply-gps -- --force --all
```

On **Maps** / **Polling Units**, use **Align to INEC GPS** (same CSV apply via `/api/polling-units/geocode` with `{ inec: true }`).

### Street geocode / approx fallback

Open **Polling Units** and click **Fill missing pins** (Photon / Nominatim, or Google when `GOOGLE_GEOCODING_API_KEY` is set). **Drop approx pins** remains a fast last resort only.

```bash
npm run pu:geocode -- --all
npm run pu:geocode -- --retry-failed --all
```

Street geocode is **a best public match**, not INEC’s survey GPS. Prefer `pu:fetch-gps` + **Align to INEC GPS** when the catalog is available.

## Apply migrations

Run in Supabase SQL Editor (or local `supabase db reset`):

1. `supabase/migrations/20250201000000_polling_units_geocode.sql`
2. `supabase/migrations/20250202000000_polling_units_inec_fields.sql`
3. `supabase/migrations/20260824000000_edo_only_polling_units.sql`
4. `supabase/migrations/20260824000001_prune_non_edo_polling_units.sql`

Adds `geocode_status`, INEC code columns, and indexes.
