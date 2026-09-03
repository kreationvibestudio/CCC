"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { openAiChatCompletion } from "@/lib/ai/openai";

export async function sendAiMessage(message: string): Promise<{ reply: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { reply: "", error: "Unauthorized" };

  const supabase = await createClient();
  const [{ count: volunteers }, { count: comments }] = await Promise.all([
    supabase.from("volunteers").select("*", { count: "exact", head: true }).eq("tenant_id", user.profile.tenant_id),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("tenant_id", user.profile.tenant_id),
  ]);

  const result = await openAiChatCompletion({
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content: `You are the AI assistant for Campaign Command Center (Hon Akhakon Anenih campaign, Nigeria). Context: ${volunteers ?? 0} volunteers, ${comments ?? 0} social comments. Give concise, actionable campaign advice.`,
      },
      { role: "user", content: message },
    ],
  });

  const reply = result.ok ? result.text : result.error;

  await supabase.from("ai_suggestions").insert({
    tenant_id: user.profile.tenant_id,
    user_id: user.id,
    suggestion_type: "chat",
    prompt: message,
    result: reply,
  });

  if (!result.ok) {
    return { reply, error: result.missingKey ? undefined : result.error };
  }
  return { reply };
}
