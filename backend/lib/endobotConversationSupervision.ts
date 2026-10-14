import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseEndoBotConversationId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

export async function getEndoBotConversationTakeoverStatus(supabase: SupabaseClient<any>, conversationId: string, userId: string): Promise<"automated" | "paused" | "not_found"> {
  const { data, error } = await supabase
    .from("endobot_conversations")
    .select("human_takeover_status")
    .eq("id", conversationId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return "not_found";
  return data.human_takeover_status === "paused" ? "paused" : "automated";
}

export async function storeAutomatedEndoBotAnswer(supabase: SupabaseClient<any>, conversationId: string, content: string): Promise<void> {
  const { error } = await supabase.from("endobot_messages").insert({ conversation_id: conversationId, role: "assistant", content });
  if (error) throw error;
}
