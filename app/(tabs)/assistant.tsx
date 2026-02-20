import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { AppShell } from "@/components/AppShell";
import { theme } from "@/constants/theme";
import { chatbotClient, type ChatMessage } from "@/services/chatbotClient";
import { useAuth } from "@/lib/auth";

const resortCode = process.env.EXPO_PUBLIC_CHATBOT_RESORT_CODE ?? "gausta";

const promptChips = ["Show arrivals for today", "Find guest by email", "Why is this token invalid?", "Summarize recent validations"];

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function WelcomeState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>Spotlio Assistant</Text>
      <Text style={styles.title}>What can I help with today?</Text>

      <View style={styles.orbWrap}>
        <View style={styles.ringOuter}>
          <View style={styles.ringMid}>
            <View style={styles.ringInner} />
          </View>
        </View>
      </View>

      <Text style={styles.subtitle}>Ask about arrivals, guest search, and purchase validation.</Text>
      <View style={styles.chips}>
        {promptChips.map((chip) => (
          <Pressable key={chip} style={styles.chip} onPress={() => onPick(chip)}>
            <Text style={styles.chipText}>{chip}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function AssistantScreen() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  );

  const sendMessage = async (value?: string) => {
    const text = (value ?? draft).trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      text,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const result = await chatbotClient.sendMessage({
        text,
        resortCode,
        sessionId,
        userId: profile?.id ?? null
      });
      setSessionId(result.sessionId);
      setMessages((prev) => [...prev, result.reply]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to contact assistant");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Assistant">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {sortedMessages.length === 0 ? (
            <WelcomeState onPick={(text) => sendMessage(text)} />
          ) : (
            <View style={styles.thread}>
              {sortedMessages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <View key={message.id} style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                    <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.assistantBubbleText]}>{message.text}</Text>
                    <Text style={styles.bubbleMeta}>{isUser ? "You" : "Spotlio Assistant"}</Text>
                  </View>
                );
              })}
              {sending ? (
                <View style={styles.typing}>
                  <ActivityIndicator size="small" color={theme.colors.accentDark} />
                  <Text style={styles.typingText}>Assistant is typing...</Text>
                </View>
              ) : null}
            </View>
          )}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composerWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask Spotlio Assistant..."
            placeholderTextColor="#8b95a7"
            style={styles.input}
            multiline
          />
          <Pressable onPress={() => sendMessage()} disabled={sending || !draft.trim()} style={styles.sendButton}>
            <Text style={styles.sendLabel}>{sending ? "..." : "Send"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 12
  },
  hero: {
    borderRadius: theme.radius.lg,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ffd7ef",
    backgroundColor: "#fff8fc"
  },
  eyebrow: {
    color: "#cc3f97",
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.3
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800"
  },
  orbWrap: {
    marginTop: 18,
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  ringOuter: {
    width: 156,
    height: 156,
    borderRadius: 999,
    backgroundColor: "#ffd4ec",
    justifyContent: "center",
    alignItems: "center"
  },
  ringMid: {
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: "#fcb4e0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#fcb4e0",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8
  },
  ringInner: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: "#fff"
  },
  subtitle: {
    color: theme.colors.mutedText,
    marginBottom: 12,
    lineHeight: 18
  },
  chips: {
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: "#f7bfdf",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#fff"
  },
  chipText: {
    color: "#a72678",
    fontWeight: "600"
  },
  thread: {
    gap: 8,
    paddingBottom: 8
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  userBubble: {
    backgroundColor: theme.colors.accent,
    alignSelf: "flex-end",
    borderBottomRightRadius: 6
  },
  assistantBubble: {
    backgroundColor: "#f6f7fb",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6
  },
  bubbleText: {
    lineHeight: 20
  },
  userBubbleText: {
    color: "#3e1240"
  },
  assistantBubbleText: {
    color: "#182033"
  },
  bubbleMeta: {
    marginTop: 6,
    fontSize: 11,
    color: "#6d7383"
  },
  typing: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  typingText: {
    color: theme.colors.mutedText,
    fontSize: 12
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#ffd6d6",
    borderRadius: theme.radius.md,
    padding: 10,
    marginTop: 6,
    backgroundColor: "#fff7f7"
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12
  },
  composerWrap: {
    borderTopWidth: 1,
    borderTopColor: "#eef0f3",
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end"
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: "#fff"
  },
  sendButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14
  },
  sendLabel: {
    color: "#3e1240",
    fontWeight: "700"
  }
});
