import { Platform } from "react-native";
import { API_URL } from "./config";
import { getAccessToken } from "./session";

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
  workspace: { name: string; slug: string; party: string } | null;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}/api/agent/${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export const agentApi = {
  session: () => request<SessionInfo>("session", { method: "POST" }),
  assigned: () => request<{ units: AgentUnit[] }>("assigned-pus"),
  nearest: (lat: number, lng: number) =>
    request<{ units: AgentUnit[] }>(`nearest-pus?lat=${lat}&lng=${lng}`),
  search: (q: string) => request<{ units: AgentUnit[] }>(`search-pus?q=${encodeURIComponent(q)}`),
  status: (body: Record<string, unknown>) => request("status", { method: "POST", body: JSON.stringify(body) }),
  report: (body: Record<string, unknown>) => request("reports", { method: "POST", body: JSON.stringify(body) }),
  results: (body: Record<string, unknown>) => request("results", { method: "POST", body: JSON.stringify(body) }),
  incident: (body: Record<string, unknown>) =>
    request("incidents", { method: "POST", body: JSON.stringify(body) }),
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
