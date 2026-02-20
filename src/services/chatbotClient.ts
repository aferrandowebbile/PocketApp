type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
};

export type SendChatMessageInput = {
  text: string;
  resortCode: string;
  sessionId?: string | null;
  userId?: string | null;
};

export type SendChatMessageResult = {
  reply: ChatMessage;
  sessionId: string | null;
};

const baseUrl = (process.env.EXPO_PUBLIC_CHATBOT_API_BASE_URL ?? "https://spotlio-rest-api-production.up.railway.app").replace(
  /\/$/,
  ""
);
const configuredPath = process.env.EXPO_PUBLIC_CHATBOT_API_PATH ?? "/api/chat";

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function pickFirstString(value: unknown, keys: string[]): string | null {
  const record = asRecord(value);
  if (!record) return null;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

export function parseBotReply(payload: unknown): { text: string | null; sessionId: string | null } {
  if (typeof payload === "string") {
    return { text: payload.trim() || null, sessionId: null };
  }

  const record = asRecord(payload);
  if (!record) return { text: null, sessionId: null };

  const direct = pickFirstString(record, ["message", "text", "reply", "answer", "content", "output"]);
  const nestedMessage = pickFirstString(record.message, ["text", "content", "reply"]);
  const nestedData = pickFirstString(record.data, ["message", "text", "content", "reply"]);
  const choices = Array.isArray(record.choices) ? record.choices : null;
  const firstChoice = choices?.[0];
  const choiceText =
    pickFirstString(firstChoice, ["text"]) ??
    pickFirstString(asRecord(firstChoice)?.message, ["content", "text", "reply"]) ??
    null;

  const text = direct ?? nestedMessage ?? nestedData ?? choiceText ?? null;
  const sessionId =
    pickFirstString(record, ["sessionId", "session_id", "conversationId", "conversation_id", "thread_id"]) ??
    pickFirstString(record.data, ["sessionId", "session_id", "conversationId", "conversation_id", "thread_id"]);

  return { text, sessionId };
}

function buildChatUrl(path: string, resortCode: string): string {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("resort_code", resortCode);
  return url.toString();
}

async function trySend(path: string, resortCode: string, body: Record<string, unknown>): Promise<{ text: string; sessionId: string | null }> {
  const response = await fetch(buildChatUrl(path, resortCode), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`${path} returned ${response.status}${errorBody ? `: ${errorBody.slice(0, 120)}` : ""}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  const parsed = parseBotReply(payload);

  if (!parsed.text) {
    throw new Error(`No assistant message returned by ${path}`);
  }

  return { text: parsed.text, sessionId: parsed.sessionId };
}

export const chatbotClient = {
  async sendMessage(input: SendChatMessageInput): Promise<SendChatMessageResult> {
    const trimmed = input.text.trim();
    if (!trimmed) throw new Error("Message is empty");

    const requestBody: Record<string, unknown> = {
      message: trimmed,
      text: trimmed,
      prompt: trimmed,
      resort_code: input.resortCode,
      resortCode: input.resortCode,
      session_id: input.sessionId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      user_id: input.userId ?? undefined,
      userId: input.userId ?? undefined
    };

    const paths = [configuredPath, "/api/chat", "/chat", "/api/messages"].filter(
      (value, index, list) => value.startsWith("/") && list.indexOf(value) === index
    );

    let lastError: Error | null = null;
    for (const path of paths) {
      try {
        const result = await trySend(path, input.resortCode, requestBody);
        return {
          sessionId: result.sessionId ?? input.sessionId ?? null,
          reply: {
            id: createId("assistant"),
            role: "assistant",
            text: result.text,
            createdAt: new Date().toISOString()
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown chatbot error");
      }
    }

    throw lastError ?? new Error("Unable to reach chatbot API");
  }
};
