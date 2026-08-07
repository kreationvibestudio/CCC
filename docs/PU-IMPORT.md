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
npm run pu:geocode -- --limit=50
```

## Apply migrations

Run in Supabase SQL Editor (or local `supabase db reset`):

1. `supabase/migrations/20250201000000_polling_units_geocode.sql`
2. `supabase/migrations/20250202000000_polling_units_inec_fields.sql`

Adds `geocode_status`, INEC code columns, and indexes.
