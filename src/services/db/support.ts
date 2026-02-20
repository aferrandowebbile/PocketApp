import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { zendeskClient } from "@/services/zendeskClient";
import type { TicketMessage } from "@/types/domain";

type NewTicketMessage = {
  ticket_id: string;
  company_id: string;
  direction: "customer" | "spotlio";
  type: "text" | "audio";
  body_text?: string | null;
  audio_storage_path?: string | null;
  audio_duration_ms?: number | null;
};

export async function uploadTicketAudio(params: {
  ticketId: string;
  uri: string;
}): Promise<{ storagePath: string; publicUrl: string }> {
  const filename = `${params.ticketId}/${Date.now()}.m4a`;
  const fileData = await fetch(params.uri).then((res) => res.arrayBuffer());

  const uploadResult = await supabase.storage.from("ticket-audio").upload(filename, fileData, {
    contentType: "audio/m4a",
    upsert: false
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const { data: publicData } = supabase.storage.from("ticket-audio").getPublicUrl(filename);
  return {
    storagePath: filename,
    publicUrl: publicData.publicUrl
  };
}

export async function insertTicketMessage(message: NewTicketMessage): Promise<void> {
  const { error } = await supabase.from("ticket_messages").insert(message);
  if (error) throw error;
}

export async function sendSupportTextReply(params: {
  ticketId: string;
  companyId: string;
  text: string;
}): Promise<void> {
  await zendeskClient.replyToTicket(params.ticketId, {
    companyId: params.companyId,
    type: "text",
    text: params.text
  });

  await insertTicketMessage({
    ticket_id: params.ticketId,
    company_id: params.companyId,
    direction: "spotlio",
    type: "text",
    body_text: params.text,
    audio_storage_path: null,
    audio_duration_ms: null
  });
}

export async function sendSupportAudioReply(params: {
  ticketId: string;
  companyId: string;
  audioUri: string;
  durationMs: number;
}): Promise<void> {
  const upload = await uploadTicketAudio({ ticketId: params.ticketId, uri: params.audioUri });

  await zendeskClient.replyToTicket(params.ticketId, {
    companyId: params.companyId,
    type: "audio",
    audioUrl: upload.publicUrl,
    durationMs: params.durationMs
  });

  await insertTicketMessage({
    ticket_id: params.ticketId,
    company_id: params.companyId,
    direction: "spotlio",
    type: "audio",
    body_text: null,
    audio_storage_path: upload.storagePath,
    audio_duration_ms: params.durationMs
  });
}

export function subscribeToTicketMessages(
  ticketId: string,
  onInsert: (message: TicketMessage) => void
): RealtimeChannel {
  return supabase
    .channel(`ticket-${ticketId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "ticket_messages",
        filter: `ticket_id=eq.${ticketId}`
      },
      (payload) => {
        const next = payload.new as TicketMessage;
        onInsert(next);
      }
    )
    .subscribe();
}

export async function unsubscribeFromChannel(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}
