# Agent mobile app

Android-first Expo app for the Agent Portal lives in [`apps/agent`](../apps/agent/README.md).

Field flow: enter the HQ-issued **agent code** at the assigned polling unit (GPS is checked at sign-in) → status, report, results, or incident. Camera photos and SQLite-queued writes sync when the phone is back online. HQ issues and resets codes from Polling units → PU Agents.

Android APK: [EAS-SETUP.md](EAS-SETUP.md). Play Store listing: [PLAY-STORE.md](PLAY-STORE.md).

Production needs `supabase/migrations/20260823000003_agent_access_codes.sql` applied once (HQ has a Copy SQL control if the table is missing).
