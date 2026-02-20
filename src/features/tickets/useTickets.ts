import { useCallback, useEffect, useState } from "react";
import { zendeskClient } from "@/services/zendeskClient";
import type { Ticket, TicketFilter } from "@/types/domain";

export function useTickets(companyId: string | undefined, filter: TicketFilter) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await zendeskClient.getTickets(companyId, filter);
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return { tickets, loading, error, reload: load };
}
