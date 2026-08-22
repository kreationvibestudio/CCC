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
import { jsonToFormData } from "@/lib/agent/form-data";
import { isResponse, jsonError, jsonOk, requireAgentApi } from "@/lib/agent/http";
import { nudgeAgent, uploadAgentMedia, upsertPushToken } from "@/lib/agent/media";

export const runtime = "nodejs";
export const maxDuration = 60;

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return response;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

function pathKey(params: { path?: string[] }) {
  return (params.path ?? []).join("/");
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
  const agent = await requireAgentApi();
  if (isResponse(agent)) return cors(agent);

  if (key === "session") {
    return cors(
      jsonOk({
        id: agent.id,
        email: agent.email,
        full_name: agent.profile.full_name,
        role: agent.role,
        tenant_id: agent.profile.tenant_id,
        workspace: agent.workspace,
      })
    );
  }

  if (key === "assigned-pus") {
    const units = await getAssignedPollingUnits(agent.id, agent.profile.tenant_id);
    return cors(jsonOk({ units }));
  }

  if (key === "nearest-pus") {
    const lat = Number(request.nextUrl.searchParams.get("lat"));
    const lng = Number(request.nextUrl.searchParams.get("lng"));
    const units = await findNearestPollingUnits(lat, lng);
    return cors(jsonOk({ units }));
  }

  if (key === "search-pus") {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const units = await searchPollingUnitsByCode(q);
    return cors(jsonOk({ units }));
  }

  return cors(jsonError(404, "Unknown agent endpoint"));
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = pathKey({ path });

  if (key === "session") {
    const agent = await requireAgentApi();
    if (isResponse(agent)) return cors(agent);
    return cors(
      jsonOk({
        id: agent.id,
        email: agent.email,
        full_name: agent.profile.full_name,
        role: agent.role,
        tenant_id: agent.profile.tenant_id,
        workspace: agent.workspace,
      })
    );
  }

  const agent = await requireAgentApi();
  if (isResponse(agent)) return cors(agent);

  if (key === "media") {
    const form = await request.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") ?? "incident");
    const kind = kindRaw === "result_sheet" ? "result_sheet" : "incident";
    if (!(file instanceof File)) return cors(jsonError(400, "file is required"));
    const result = await uploadAgentMedia(agent, file, kind);
    if ("error" in result && result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }

  if (key === "push-token") {
    const body = await readJson(request);
    const result = await upsertPushToken(
      agent,
      String(body.token ?? ""),
      String(body.platform ?? "android")
    );
    if ("error" in result && result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }

  if (key === "nudge") {
    if (
      !hasPermission(agent.role, "situation_room.manage") &&
      !hasPermission(agent.role, "polling_units.manage") &&
      !hasPermission(agent.role, "admin.users")
    ) {
      return cors(jsonError(403, "Forbidden"));
    }
    const body = await readJson(request);
    const result = await nudgeAgent(agent, String(body.user_id ?? ""), String(body.message ?? ""));
    if ("error" in result && result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }

  const body = await readJson(request);
  const fd = jsonToFormData(body);

  if (key === "status") {
    const result = await updatePuStatus(fd);
    if (result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }
  if (key === "reports") {
    const result = await submitAgentReport(fd);
    if (result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }
  if (key === "results") {
    const result = await submitElectionResult(fd);
    if (result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }
  if (key === "incidents") {
    const result = await reportIncident(fd);
    if (result.error) return cors(jsonError(400, result.error));
    return cors(jsonOk(result));
  }

  return cors(jsonError(404, "Unknown agent endpoint"));
}
