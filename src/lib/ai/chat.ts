"use server";

import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { openAiChatCompletion } from "@/lib/ai/openai";

const MAX_MESSAGE_CHARS = 4000;

export async function sendAiMessage(message: string): Promise<{ reply: string; error?: string }> {
  // Gated on ai.use: every call spends OpenAI quota against the workspace.
  const gate = await authorize("ai.use");
  if (!gate.ok) return { reply: "", error: gate.error };
  const user = gate.user;

  const prompt = message.trim();
  if (!prompt) return { reply: "", error: "Ask a question first" };
  if (prompt.length > MAX_MESSAGE_CHARS) {
    return { reply: "", error: `Keep questions under ${MAX_MESSAGE_CHARS} characters` };
  }

  const supabase = await createClient();
  const tenantId = user.profile.tenant_id;
  const [{ count: volunteers }, { count: comments }, { count: pollingUnits }, { count: contacts }] =
    await Promise.all([
      supabase.from("volunteers").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("polling_units").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    ]);

  // Workspace name and party come from the session, so the assistant describes
  // the caller's own campaign rather than a hardcoded one.
  const workspace = user.workspace?.name?.trim() || "this campaign";
  const party = user.workspace?.party?.trim();

  const result = await openAiChatCompletion({
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content: [
          `You are the AI assistant for Campaign Command Center, supporting the ${workspace} campaign in Nigeria${party ? ` (party: ${party})` : ""}.`,
          `The user is a ${user.role.replace(/_/g, " ")}.`,
          `Current workspace data: ${volunteers ?? 0} volunteers, ${contacts ?? 0} CRM contacts, ${pollingUnits ?? 0} polling units, ${comments ?? 0} social comments.`,
          "Give concise, actionable campaign advice. Never invent figures that contradict the data above.",
        ].join(" "),
      },
      { role: "user", content: prompt },
    ],
  });

  const reply = result.ok ? result.text : result.error;

  await supabase.from("ai_suggestions").insert({
    tenant_id: tenantId,
    user_id: user.id,
    suggestion_type: "chat",
    prompt,
    result: reply,
  });

  if (!result.ok) {
    return { reply, error: result.missingKey ? undefined : result.error };
  }
  return { reply };
}
