import { Audio } from "expo-av";

export async function ensureAudioPermissions(): Promise<boolean> {
  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
}

export async function startRecording(): Promise<Audio.Recording> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
  await recording.startAsync();
  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<{ uri: string; durationMs: number }> {
  await recording.stopAndUnloadAsync();
  const status = await recording.getStatusAsync();
  const uri = recording.getURI();

  if (!uri) {
    throw new Error("Recording file is missing");
  }

  return {
    uri,
    durationMs: "durationMillis" in status ? status.durationMillis ?? 0 : 0
  };
}
