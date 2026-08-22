import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

const SESSION_KEY = "ccc-agent-session";

function client() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadStoredSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session | null) {
  if (!session) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getAccessToken() {
  const session = await loadStoredSession();
  if (!session) return null;
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 30_000 && session.refresh_token) {
    const { data, error } = await client().auth.refreshSession({ refresh_token: session.refresh_token });
    if (!error && data.session) {
      await saveSession(data.session);
      return data.session.access_token;
    }
  }
  return session.access_token;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message || "Sign in failed");
  await saveSession(data.session);
  return data.session;
}

export async function signOut() {
  await saveSession(null);
}
