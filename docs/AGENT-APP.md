# Agent mobile app

Android-first Expo app for the Agent Portal lives in [`apps/agent`](../apps/agent/README.md).

Web `/agent` remains the no-install fallback. Native clients call `/api/agent/*` with a Bearer Supabase JWT (never the service role).
