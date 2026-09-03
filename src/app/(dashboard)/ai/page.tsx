import { AiAssistant } from "@/components/ai/ai-assistant";
import { openAiConfigured } from "@/lib/ai/openai";

export default function AiPage() {
  return <AiAssistant openaiConfigured={openAiConfigured()} />;
}
