import { getSupabaseServiceClient } from "../supabase/server-client";

export type GitHubWebhookEvent = {
  id: string;
  delivery_id: string;
  event_type: string;
  installation_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export async function insertWebhookEvent(event: {
  deliveryId: string;
  eventType: string;
  installationId?: string | null;
  payload: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("github_webhook_events")
    .insert([
      {
        delivery_id: event.deliveryId,
        event_type: event.eventType,
        installation_id: event.installationId ?? null,
        payload: event.payload
      }
    ])
    .select()
    .single();

  // If the record already exists, ignore the unique constraint error.
  if (error) {
    if (error.code === "23505" || error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data as GitHubWebhookEvent;
}
