# Polling unit import (Edo/Esan — INEC format)

## Official INEC CSV columns

Use the standard INEC export headers:

```csv
state,lg,ward,state_code,lg_code,ward_code,pu_code,code,location,ward_des,lg_des
EDO,12,01,12,04,01,001,12/04/01/001,Uromi Town Hall,Uromi I,Esan North-East
```

| INEC column | Stored as | Notes |
|-------------|-----------|--------|
| `state` | `state` | State name (e.g. EDO) |
| `lg` | `lg_code` (fallback) | LGA index/code |
| `ward` | `ward_code` (fallback) | Ward index |
| `state_code` | `state_code` | INEC state code |
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

Polling Units → **Import CSV** (batched; works with large INEC files).

## Import via CLI

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`:

```bash
npm run pu:import
npm run pu:geocode -- --limit=20
```

## Apply migrations

Run in Supabase SQL Editor:

1. `supabase/migrations/20250201000000_polling_units_geocode.sql`
2. `supabase/migrations/20250202000000_polling_units_inec_fields.sql`

Adds `geocode_status`, INEC code columns, and indexes.
