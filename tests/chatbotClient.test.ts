import { parseBotReply } from "@/services/chatbotClient";

describe("parseBotReply", () => {
  it("extracts direct string payload", () => {
    expect(parseBotReply("Hello from bot")).toEqual({ text: "Hello from bot", sessionId: null });
  });

  it("extracts nested OpenAI-style message content", () => {
    const payload = {
      choices: [{ message: { content: "Nested answer" } }],
      conversation_id: "conv_123"
    };

    expect(parseBotReply(payload)).toEqual({ text: "Nested answer", sessionId: "conv_123" });
  });

  it("extracts common text fields", () => {
    const payload = {
      data: { reply: "Use arrivals tab", session_id: "sess_456" }
    };

    expect(parseBotReply(payload)).toEqual({ text: "Use arrivals tab", sessionId: "sess_456" });
  });
});
