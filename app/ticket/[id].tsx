import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppShell } from "@/components/AppShell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { theme } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { canReplyToTickets } from "@/lib/permissions";
import { sendSupportAudioReply, sendSupportTextReply } from "@/services/db/support";
import { ensureAudioPermissions, startRecording, stopRecording } from "@/features/tickets/voice";
import { useTicketDetail } from "@/features/tickets/useTicketDetail";

export default function TicketDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const ticketId = params.id;
  const { profile } = useAuth();
  const { ticket, messages, loading, error: loadError, reload } = useTicketDetail(ticketId, profile?.company_id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isReadOnly = !canReplyToTickets(profile);

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const title = useMemo(() => ticket?.subject ?? "Ticket", [ticket]);

  const sendText = async () => {
    if (!text.trim() || !profile?.company_id) return;
    setBusy(true);
    setError(null);
    try {
      await sendSupportTextReply({
        ticketId,
        companyId: profile.company_id,
        text: text.trim()
      });
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (!profile?.company_id) return;

    if (!recordingActive) {
      const granted = await ensureAudioPermissions();
      if (!granted) {
        setError("Microphone permission denied");
        return;
      }
      const rec = await startRecording();
      recordingRef.current = rec;
      setRecordingDuration(0);
      setRecordingActive(true);
      tickerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1000);
      }, 1000);
      return;
    }

    if (!recordingRef.current) return;
    setBusy(true);
    setError(null);
    try {
      if (tickerRef.current) clearInterval(tickerRef.current);
      const result = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      setRecordingActive(false);

      await sendSupportAudioReply({
        ticketId,
        companyId: profile.company_id,
        audioUri: result.uri,
        durationMs: result.durationMs
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice note failed");
    } finally {
      setBusy(false);
      setRecordingDuration(0);
    }
  };

  return (
    <AppShell title={title}>
      {loading ? <Text>Loading...</Text> : null}
      {loadError ? (
        <View style={styles.loadErrorWrap}>
          <Text style={styles.error}>{loadError}</Text>
          <PrimaryButton label="Retry" onPress={() => reload().catch(() => undefined)} />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView style={styles.thread}>
        {messages.map((message) => {
          const isSpotlio = message.direction === "spotlio";
          return (
            <View key={message.id} style={[styles.bubble, isSpotlio ? styles.spotlioBubble : styles.customerBubble]}>
              <Text style={styles.author}>{isSpotlio ? "Spotlio Team" : "You"}</Text>
              {message.type === "text" ? (
                <Text style={styles.messageText}>{message.body_text}</Text>
              ) : (
                <Text style={styles.messageText}>Voice note ({Math.round((message.audio_duration_ms ?? 0) / 1000)}s)</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={[styles.input, isReadOnly ? styles.inputDisabled : null]}
          value={text}
          onChangeText={setText}
          placeholder={isReadOnly ? "Viewer role: replies disabled" : "Reply to this ticket"}
          editable={!isReadOnly}
        />
        <PrimaryButton label="Send" onPress={sendText} disabled={isReadOnly || busy || !text.trim()} />
        <View style={{ height: 8 }} />
        <Pressable
          onPress={toggleRecording}
          disabled={isReadOnly || busy}
          style={[styles.voiceButton, isReadOnly || busy ? styles.disabled : null]}
        >
          <Text style={styles.voiceButtonText}>
            {recordingActive ? `Stop recording (${Math.round(recordingDuration / 1000)}s)` : "Record voice note"}
          </Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: theme.colors.danger,
    marginBottom: 8
  },
  loadErrorWrap: {
    marginBottom: 8
  },
  thread: {
    flex: 1
  },
  bubble: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8
  },
  customerBubble: {
    backgroundColor: "#f3f4f6"
  },
  spotlioBubble: {
    backgroundColor: "#ffe4f3"
  },
  author: {
    fontWeight: "700",
    marginBottom: 4
  },
  messageText: {
    color: theme.colors.text
  },
  composer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  inputDisabled: {
    backgroundColor: "#f3f4f6"
  },
  voiceButton: {
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10
  },
  voiceButtonText: {
    color: theme.colors.accentDark,
    fontWeight: "700"
  },
  disabled: {
    opacity: 0.5
  }
});
