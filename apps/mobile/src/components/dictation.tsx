import type { Spec } from "@react-native-ai/apple/src/NativeAppleTranscription";
import {
  AudioModule,
  type AudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { File } from "expo-file-system";
import { type FC, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TurboModuleRegistry, View } from "react-native";
import { Check, X } from "./icons";

const apple = TurboModuleRegistry.get<Spec>("NativeAppleTranscription");
const locale = Intl.DateTimeFormat().resolvedOptions().locale;

export const canDictate = apple?.isAvailable(locale) ?? false;

const { extension, sampleRate, numberOfChannels, bitRate, ios } = RecordingPresets.HIGH_QUALITY;
const RECORDING = {
  extension,
  sampleRate,
  numberOfChannels,
  bitRate,
  ...ios,
  isMeteringEnabled: true,
};
const BARS = 28;
const QUIET_DB = -60;

const transcribe = async (uri: string) => {
  const result = await globalThis["__apple__llm__transcribe__"](
    await new File(uri).arrayBuffer(),
    locale,
  );
  return result.segments
    .map((segment) => segment.text)
    .join(" ")
    .trim();
};

type Phase = "idle" | "recording" | "transcribing";

export const useDictation = (
  onText: (text: string) => void,
  onError: (message: string) => void,
) => {
  const recorder = useRef<AudioRecorder>(undefined);
  const [phase, setPhase] = useState<Phase>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);

  useEffect(
    () => () => {
      recorder.current?.release();
      recorder.current = undefined;
    },
    [],
  );

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      const status = recorder.current?.getStatus();
      if (!status) return;
      setSeconds(Math.floor(status.durationMillis / 1000));
      const level = Math.min(
        1,
        Math.max(0, ((status.metering ?? QUIET_DB) - QUIET_DB) / -QUIET_DB),
      );
      setLevels((current) => [...current.slice(1 - BARS), level]);
    }, 100);
    return () => clearInterval(timer);
  }, [phase]);

  const release = async () => {
    await recorder.current?.stop();
    await setAudioModeAsync({ allowsRecording: false });
  };

  const start = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        onError("Allow the microphone in Settings to use voice.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await apple?.prepare(locale);
      recorder.current ??= new AudioModule.AudioRecorder(RECORDING);
      await recorder.current.prepareToRecordAsync();
      recorder.current.record();
      setLevels([]);
      setSeconds(0);
      setPhase("recording");
    } catch {
      onError("Voice could not start. Try again.");
    }
  };

  const cancel = async () => {
    setPhase("idle");
    await release().catch(() => undefined);
  };

  const finish = async () => {
    setPhase("transcribing");
    try {
      await release();
      const uri = recorder.current?.uri;
      if (uri) onText(await transcribe(uri));
    } catch {
      onError("Voice could not be turned into text. Try again.");
    }
    setPhase("idle");
  };

  return { phase, levels, seconds, start, cancel, finish };
};

export const DictationBar: FC<{
  dictation: Omit<ReturnType<typeof useDictation>, "start">;
}> = ({ dictation: { phase, levels, seconds, cancel, finish } }) => (
  <View className="flex-1 flex-row items-center gap-2">
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cancel voice"
      onPress={() => void cancel()}
      className="bg-foreground/10 size-9 items-center justify-center rounded-full"
    >
      <X size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
    </Pressable>
    <View className="h-8 flex-1 flex-row items-center justify-end gap-0.5 overflow-hidden">
      {levels.map((level, at) => (
        <View
          key={at}
          style={{ height: 2 + level * 26 }}
          className="bg-foreground/70 w-1 rounded-full"
        />
      ))}
    </View>
    <Text className="text-muted-foreground font-sans w-12 text-center text-sm">
      {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
    </Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Turn voice into text"
      disabled={phase !== "recording"}
      onPress={() => void finish()}
      className="bg-primary size-9 items-center justify-center rounded-full"
    >
      {phase === "transcribing" ? (
        <ActivityIndicator size="small" colorClassName="accent-primary-foreground" />
      ) : (
        <Check size={20} strokeWidth={2} colorClassName="accent-primary-foreground" />
      )}
    </Pressable>
  </View>
);
