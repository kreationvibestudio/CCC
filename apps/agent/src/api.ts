import { Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { API_URL } from "./config";
import { publicPayload } from "./payload";
import { getAccessToken, signOut } from "./session";
import type { PartyOption } from "./parties";

export type AgentUnit = {
  id: string;
  code: string;
  pu_code: string | null;
  name: string;
  ward: string;
  lga: string;
  latitude: number | null;
  longitude: number | null;
  distance_m?: number | null;
};

export type SessionInfo = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
  campaign_party?: string;
  workspace: { name: string; slug: string; party: string } | null;
  parties?: { featured: PartyOption[]; other: PartyOption[] };
};

export class AgentAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type CodeLoginResult = {
  session: Session;
  agent: { id: string; email: string; full_name: string; role: string };
  unit: AgentUnit;
};

async function parseAgentResponse<T>(res: Response): Promise<T> {
  if (res.status === 307 || res.status === 308 || res.status === 405) {
    throw new Error(
      "This app reached the HQ website, not the Agent API. Deploy the Agent branch to Vercel production (ccc-three-kappa.vercel.app), then try again."
    );
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 || res.status === 403) {
    if (res.status === 401) await signOut();
    throw new AgentAuthError(json.error || "Unauthorized", res.status);
  }
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  async function once(token: string | null) {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(`${API_URL}/api/agent/${path}`, { ...init, headers, redirect: "manual" });
  }

  let token = await getAccessToken();
  let res = await once(token);
  if (res.status === 401) {
    token = await getAccessToken(true);
    res = await once(token);
  }
  return parseAgentResponse<T>(res);
}

export const agentApi = {
  async codeLogin(code: string, latitude: number | null, longitude: number | null) {
    const res = await fetch(`${API_URL}/api/agent/code-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, latitude, longitude }),
      redirect: "manual",
    });
    return parseAgentResponse<CodeLoginResult>(res);
  },
  session: () => request<SessionInfo>("session", { method: "POST" }),
  assigned: () => request<{ units: AgentUnit[] }>("assigned-pus"),
  nearest: (lat: number, lng: number) =>
    request<{ units: AgentUnit[] }>(`nearest-pus?lat=${lat}&lng=${lng}`),
  search: (q: string) => request<{ units: AgentUnit[] }>(`search-pus?q=${encodeURIComponent(q)}`),
  status: (body: Record<string, unknown>) =>
    request("status", { method: "POST", body: JSON.stringify(publicPayload(body)) }),
  report: (body: Record<string, unknown>) =>
    request("reports", { method: "POST", body: JSON.stringify(publicPayload(body)) }),
  results: (body: Record<string, unknown>) =>
    request("results", { method: "POST", body: JSON.stringify(publicPayload(body)) }),
  incident: (body: Record<string, unknown>) =>
    request("incidents", { method: "POST", body: JSON.stringify(publicPayload(body)) }),
  pushToken: (token: string) =>
    request("push-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    }),
  async upload(uri: string, kind: "result_sheet" | "incident") {
    const token = await getAccessToken();
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", {
      uri,
      name: `${kind}.jpg`,
      type: "image/jpeg",
    } as unknown as Blob);
    const res = await fetch(`${API_URL}/api/agent/media`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || json.error) throw new Error(json.error || "Upload failed");
    return json.url!;
  },
};
