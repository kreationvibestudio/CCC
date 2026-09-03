"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendAiMessage } from "@/lib/ai/chat";

export function AiAssistant({ openaiConfigured }: { openaiConfigured: boolean }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    startTransition(async () => {
      const { reply } = await sendAiMessage(text);
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <PageHeader title="AI Assistant" description="Campaign strategy, messaging and field ops guidance" />
      {!openaiConfigured ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-medium">OPENAI_API_KEY is not set</span> for this environment.
          Add a valid key in Vercel → Project → Settings → Environment Variables (Production), then redeploy.
        </p>
      ) : null}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask about voter outreach, comment replies, event planning, or election day operations.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask the campaign AI…"
              disabled={pending}
            />
            <Button onClick={send} disabled={pending}>
              {pending ? "…" : "Send"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
