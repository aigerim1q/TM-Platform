import { api } from "@/lib/api";

export async function clearAiChatHistory(mode: string): Promise<void> {
  await api.delete("/ai-chat/messages", {
    params: { mode },
  });
}
