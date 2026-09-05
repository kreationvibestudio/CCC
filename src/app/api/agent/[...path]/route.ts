import { NextRequest, NextResponse } from "next/server";
import { hasPermission } from "@/types/auth";
import {
  findNearestPollingUnits,
  getAssignedPollingUnits,
  reportIncident,
  searchPollingUnitsByCode,
  submitAgentReport,
  submitElectionResult,
  updatePuStatus,
} from "@/lib/agent/actions";
import { loginWithAgentCode } from "@/lib/agent/code-login";
import { clientIp } from "@/lib/rate-limit";
import { jsonToFormData } from "@/lib/agent/form-data";
import { isResponse, jsonError, jsonOk, requireAgentApi } from "@/lib/agent/http";
import { nudgeAgent, uploadAgentMedia, upsertPushToken } from "@/lib/agent/media";
import { FEATURED_PARTIES, OTHER_MAJOR_PARTIES } from "@/lib/elections/parties";
import type { AuthUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Reflect an allowed browser origin instead of `*`.
 *
 * The Expo agent app is not a browser and sends no Origin, so it is unaffected.
 * Requests with an unknown Origin get no CORS header and the browser blocks the
 * response. Extra web origins can be added with AGENT_API_ALLOWED_ORIGINS.
 */
function allowedOrigins() {
  const configured = (process.env.AGENT_API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const self = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (self) configured.push(self);
  return configured;
}

function cors(response: NextResponse, origin?: string | null) {
  const requested = origin?.trim().replace(/\/$/, "");
  if (requested && allowedOrigins().includes(requested)) {
    response.headers.set("Access-Control-Allow-Origin", requested);
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return cors(new NextResponse(null, { status: 204 }), request.headers.get("origin"));
}

function pathKey(params: { path?: string[] }) {
  return (params.path ?? []).join("/");
}

function sessionBody(agent: AuthUser) {
  return {
    id: agent.id,
    email: agent.email,
    full_name: agent.profile.full_name,
    role: agent.role,
    tenant_id: agent.profile.tenant_id,
    campaign_party: agent.workspace?.party ?? "",
    workspace: agent.workspace,
    parties: { featured: FEATURED_PARTIES, other: OTHER_MAJOR_PARTIES },
  };
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = pathKey({ path });
  const reply = (response: NextResponse) => cors(response, request.headers.get("origin"));
  const agent = await requireAgentApi();
  if (isResponse(agent)) return reply(agent);

  if (key === "session") {
    return reply(jsonOk(sessionBody(agent)));
  }

  if (key === "assigned-pus") {
    const units = await getAssignedPollingUnits();
    return reply(jsonOk({ units }));
  }

  if (key === "nearest-pus") {
    const lat = Number(request.nextUrl.searchParams.get("lat"));
    const lng = Number(request.nextUrl.searchParams.get("lng"));
    const units = await findNearestPollingUnits(lat, lng);
    return reply(jsonOk({ units }));
  }

  if (key === "search-pus") {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const units = await searchPollingUnitsByCode(q);
    return reply(jsonOk({ units }));
  }

  return reply(jsonError(404, "Unknown agent endpoint"));
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = pathKey({ path });
  const reply = (response: NextResponse) => cors(response, request.headers.get("origin"));

  if (key === "code-login") {
    const body = await readJson(request);
    const latRaw = body.latitude;
    const lngRaw = body.longitude;
    const latitude =
      latRaw === null || latRaw === undefined || latRaw === ""
        ? null
        : Number(latRaw);
    const longitude =
      lngRaw === null || lngRaw === undefined || lngRaw === ""
        ? null
        : Number(lngRaw);
    const result = await loginWithAgentCode({
      code: String(body.code ?? ""),
      latitude,
      longitude,
      clientIp: clientIp(request.headers),
    });
    if (result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }

  if (key === "session") {
    const agent = await requireAgentApi();
    if (isResponse(agent)) return reply(agent);
    return reply(jsonOk(sessionBody(agent)));
  }

  const agent = await requireAgentApi();
  if (isResponse(agent)) return reply(agent);

  if (key === "media") {
    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") ?? "incident");
    const kind: "result_sheet" | "incident" | "report" =
      kindRaw === "result_sheet" ? "result_sheet" : kindRaw === "report" ? "report" : "incident";
    if (!(file instanceof File)) return reply(jsonError(400, "file is required"));
    const result = await uploadAgentMedia(agent, file, kind);
    if ("error" in result && result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }

  if (key === "push-token") {
    const body = await readJson(request);
    const result = await upsertPushToken(
      agent,
      String(body.token ?? ""),
      String(body.platform ?? "android")
    );
    if ("error" in result && result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }

  if (key === "nudge") {
    if (
      !hasPermission(agent.role, "situation_room.manage") &&
      !hasPermission(agent.role, "polling_units.manage") &&
      !hasPermission(agent.role, "admin.users")
    ) {
      return reply(jsonError(403, "Forbidden"));
    }
    const body = await readJson(request);
    const result = await nudgeAgent(agent, String(body.user_id ?? ""), String(body.message ?? ""));
    if ("error" in result && result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }

  const body = await readJson(request);
  const fd = jsonToFormData(body);

  if (key === "status") {
    const result = await updatePuStatus(fd);
    if (result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }
  if (key === "reports") {
    const result = await submitAgentReport(fd);
    if (result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }
  if (key === "results") {
    const result = await submitElectionResult(fd);
    if (result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }
  if (key === "incidents") {
    const result = await reportIncident(fd);
    if (result.error) return reply(jsonError(400, result.error));
    return reply(jsonOk(result));
  }

  return reply(jsonError(404, "Unknown agent endpoint"));
}
