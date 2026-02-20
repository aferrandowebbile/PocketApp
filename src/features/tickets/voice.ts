import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import type { AudioRecorder } from "expo-audio";

export async function ensureAudioPermissions(): Promise<boolean> {
  const permission = await requestRecordingPermissionsAsync();
  return permission.granted;
}

export async function startRecording(): Promise<AudioRecorder> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true
  });

  const recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
  await recording.prepareToRecordAsync();
  recording.record();
  return recording;
}

export async function stopRecording(recording: AudioRecorder): Promise<{ uri: string; durationMs: number }> {
  await recording.stop();
  const status = recording.getStatus();
  const uri = recording.uri ?? status.url;

  if (!uri) {
    throw new Error("Recording file is missing");
  }

  return {
    uri,
    durationMs: status.durationMillis ?? Math.round(recording.currentTime * 1000)
  };
}
