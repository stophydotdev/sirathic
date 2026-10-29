import type { Mode } from "@sirathic/server/messages";
import * as Haptics from "expo-haptics";
import { type ComponentRef, type FC, useEffect, useRef, useState } from "react";
import { Animated, Keyboard, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MAX_FILE_BYTES } from "@sirathic/server/files";
import type { FileUIPart } from "ai";
import Reanimated, {
  FlipInXDown,
  FlipInXUp,
  FlipOutXDown,
  FlipOutXUp,
} from "react-native-reanimated";
import { type Attachment, filePartsOf } from "@/lib/attachments";
import { authClient } from "@/lib/auth";
import { useChatState } from "@/lib/chat-state";
import { AddMenu } from "./add-menu";
import { ArrowUp, Microphone, Search, Stop, Telescope } from "./icons";
import { AttachmentChip } from "./attachment-chip";
import { canDictate, DictationBar, useDictation } from "./dictation";
import { GLASS, GlassFill } from "./glass";
import { ModelPicker } from "./model-picker";
import { Swap } from "./motion";
import { MentionList, mentionQuery, useMentionables, withMention } from "./mention-list";
import { useSignIn } from "./sign-in";

export const MODE_DETAILS = {
  quick: {
    name: "Quick",
    description: "Searches everything first, then answers fast",
    Icon: Search,
  },
  research: {
    name: "Research",
    description: "Thinks longer and searches step by step",
    Icon: Telescope,
  },
} satisfies Record<Mode, { name: string; description: string; Icon: typeof Search }>;

const TOO_BIG = "Upload images, PDFs or UTF-8 text files up to 10 MB each.";

const ROW = 48;
const LINE = 26;
const PAD = 11;
const MAX_LINES = 5;

export const Composer: FC<{
  placeholder: string;
  busy: boolean;
  onSend: (text: string, files: FileUIPart[]) => void;
  onStop: () => void;
  bot?: boolean;
}> = ({ placeholder, busy, onSend, onStop, bot = false }) => {
  const [text, setText] = useState(() => useChatState.getState().draft);
  const [typing, setTyping] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const box = useRef<ComponentRef<typeof View>>(null);
  const hidden = useRef(new Animated.Value(0)).current;
  const mode = useChatState((s) => s.mode);
  const setMode = useChatState((s) => s.setMode);
  const query = mentionQuery(text);
  const mentionables = useMentionables(query !== undefined);

  useEffect(() => useChatState.getState().setDraft(""), []);
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () =>
      setTyping(input.current?.isFocused() ?? false),
    );
    const closed = Keyboard.addListener("keyboardDidHide", () => setTyping(false));
    return () => {
      shown.remove();
      closed.remove();
    };
  }, []);
  const signedIn = authClient.useSession().data !== null;
  const ask = useSignIn((s) => s.ask);
  const ready = (text.trim() !== "" || files.length > 0) && !sending;

  const attach = (picked: Attachment[]) => {
    const fitting = picked.filter((file) => file.size <= MAX_FILE_BYTES);
    setError(fitting.length < picked.length ? TOO_BIG : undefined);
    setFiles((current) => [
      ...current,
      ...fitting.filter((file) => !current.some((kept) => kept.key === file.key)),
    ]);
  };

  const startMention = () => {
    setText((current) => (current === "" || /\s$/u.test(current) ? `${current}@` : `${current} @`));
    input.current?.focus();
  };

  const send = async () => {
    if (!signedIn) {
      ask();
      return;
    }
    if (!ready) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setError(undefined);
    try {
      onSend(text.trim(), await filePartsOf(files));
      setText("");
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSending(false);
  };

  const dictation = useDictation((spoken) => {
    if (spoken !== "")
      setText((current) => (current.trim() === "" ? spoken : `${current.trimEnd()} ${spoken}`));
  }, setError);
  const dictating = dictation.phase !== "idle";
  const researching = !bot && mode === "research";
  const compact = !typing && !dictating && !researching && text === "" && files.length === 0;

  return (
    <>
      {query !== undefined && (
        <MentionList
          items={mentionables}
          query={query}
          onChoose={(name) => setText(withMention(text, name))}
        />
      )}
      <Animated.View
        collapsable={false}
        style={{ opacity: hidden.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}
        className="w-full"
      >
        <View
          ref={box}
          style={{ paddingBottom: compact ? 0 : ROW }}
          className={`w-full rounded-3xl ${GLASS ? "border-foreground/10 border shadow-sm" : "bg-field"}`}
        >
          <GlassFill radius={24} />
          {files.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 px-3 pt-3"
            >
              {files.map((file) => (
                <AttachmentChip
                  key={file.key}
                  name={file.name}
                  mediaType={file.mediaType}
                  uri={file.uri}
                  onRemove={() =>
                    setFiles((current) => current.filter((kept) => kept.key !== file.key))
                  }
                />
              ))}
            </ScrollView>
          )}
          {error && <Text className="text-destructive font-sans px-4 pt-2 text-xs">{error}</Text>}
          <TextInput
            ref={input}
            value={text}
            onChangeText={setText}
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
            placeholder={placeholder}
            placeholderTextColorClassName="accent-muted-foreground"
            multiline
            spellCheck={false}
            textAlignVertical="top"
            style={{
              minHeight: ROW,
              maxHeight: LINE * MAX_LINES + PAD,
              paddingStart: compact ? start + 4 : 16,
              paddingEnd: compact ? end + 4 : 16,
              paddingTop: PAD,
              paddingBottom: compact ? PAD : 0,
            }}
            className="text-foreground font-sans text-base"
          />
          <View
            pointerEvents="box-none"
            className="absolute inset-x-0 bottom-0 h-12 overflow-hidden px-1.5"
          >
            {dictating ? (
              <Reanimated.View
                key="dictation"
                entering={FlipInXDown.duration(260)}
                exiting={FlipOutXUp.duration(260)}
                className="flex-1 flex-row items-center"
              >
                <DictationBar dictation={dictation} />
              </Reanimated.View>
            ) : (
              <Reanimated.View
                key="draft"
                entering={FlipInXUp.duration(260)}
                exiting={FlipOutXDown.duration(260)}
                pointerEvents="box-none"
                className="flex-1 flex-row items-center justify-between"
              >
                <View
                  onLayout={(event) => setStart(event.nativeEvent.layout.width + 6)}
                  className="flex-row items-center gap-1"
                >
                  <AddMenu modes={!bot} onAttach={attach} onPlugins={startMention} />
                  {researching && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Turn off Research"
                      onPress={() => setMode("quick")}
                      className="bg-super/15 h-8 flex-row items-center gap-1 rounded-full px-2.5"
                    >
                      <Telescope size={16} strokeWidth={1.75} colorClassName="accent-super" />
                      <Text className="text-super font-sans text-sm">Research</Text>
                    </Pressable>
                  )}
                </View>
                <View
                  onLayout={(event) => setEnd(event.nativeEvent.layout.width + 6)}
                  className="flex-row items-center gap-1"
                >
                  {!compact && <ModelPicker box={box} hidden={hidden} />}
                  {canDictate && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Voice"
                      onPress={() => {
                        setError(undefined);
                        void dictation.start();
                      }}
                      className="active:bg-muted size-10 items-center justify-center rounded-full"
                    >
                      <Microphone size={22} strokeWidth={1.75} colorClassName="accent-foreground" />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={busy ? "Stop response" : "Submit"}
                    disabled={!busy && !ready}
                    onPress={busy ? onStop : () => void send()}
                    className={`${busy || ready ? "bg-primary" : "bg-foreground/15"} size-9 items-center justify-center rounded-full`}
                  >
                    <Swap
                      swapped={busy}
                      from={
                        <ArrowUp
                          size={20}
                          strokeWidth={1.75}
                          colorClassName={
                            busy || ready ? "accent-primary-foreground" : "accent-background"
                          }
                        />
                      }
                      to={<Stop size={14} colorClassName="accent-primary-foreground" />}
                    />
                  </Pressable>
                </View>
              </Reanimated.View>
            )}
          </View>
        </View>
      </Animated.View>
    </>
  );
};
