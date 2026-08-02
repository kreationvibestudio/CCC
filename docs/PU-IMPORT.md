# Polling unit import (Edo/Esan)

## CSV format

Place INEC data in `supabase/data/edo-esan-polling-units.csv`:

```csv
code,name,ward,lga,registered_voters,latitude,longitude,address
ED/ESN/01/001,Uromi Town Hall PU 001,Uromi I,Esan North-East,892,6.7102,6.3301,Uromi Town Hall
```

## Import via UI

Polling Units → **Import CSV** (uses your logged-in tenant).

## Import via CLI

Requires `SUPABASE_SERVICE_ROLE_KEY` in env:

```bash
npm run pu:import
npm run pu:geocode -- --limit=20
```

## Apply migration

Run `supabase/migrations/20250201000000_polling_units_geocode.sql` in Supabase SQL Editor.

Adds `geocode_status` column and `campaign_locations` table.
