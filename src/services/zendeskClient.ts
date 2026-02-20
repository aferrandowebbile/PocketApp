import type { Ticket, TicketMessage } from "@/types/domain";

const baseUrl = process.env.EXPO_PUBLIC_ZENDESK_API_BASE_URL ?? "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Zendesk backend error (${response.status})`);
  }

  return (await response.json()) as T;
}

export const zendeskClient = {
  getTickets: async (companyId: string, filter?: string): Promise<Ticket[]> => {
    const query = new URLSearchParams({ companyId });
    if (filter && filter !== "all") query.set("status", filter);
    return request<Ticket[]>(`/tickets?${query.toString()}`);
  },

  getTicket: async (id: string, companyId: string): Promise<{ ticket: Ticket; messages: TicketMessage[] }> => {
    const query = new URLSearchParams({ companyId });
    return request<{ ticket: Ticket; messages: TicketMessage[] }>(`/tickets/${id}?${query.toString()}`);
  },

  replyToTicket: async (
    id: string,
    payload: { companyId: string; type: "text" | "audio"; text?: string; audioUrl?: string; durationMs?: number }
  ): Promise<{ success: true }> => {
    return request<{ success: true }>(`/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
