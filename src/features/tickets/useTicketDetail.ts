import { useCallback, useEffect, useState } from "react";
import { subscribeToTicketMessages, unsubscribeFromChannel } from "@/services/db/support";
import { zendeskClient } from "@/services/zendeskClient";
import type { Ticket, TicketMessage } from "@/types/domain";

export function useTicketDetail(ticketId: string, companyId: string | undefined) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await zendeskClient.getTicket(ticketId, companyId);
      setTicket(data.ticket);
      setMessages(data.messages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId, companyId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!ticketId) return;
    const channel = subscribeToTicketMessages(ticketId, (next) => {
      setMessages((prev) => [...prev, next]);
    });

    return () => {
      unsubscribeFromChannel(channel).catch(() => undefined);
    };
  }, [ticketId]);

  return { ticket, messages, loading, error, reload: load };
}
