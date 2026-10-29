import {
  ANSWER_LANGUAGES,
  ANSWER_LENGTHS,
  LIST_STYLES,
  MADHABS,
  type Settings,
} from "@sirathic/server/settings";
import { type FC, useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { Group, Segmented, Setting, Toggle } from "./settings-controls";

const MADHAB_NAMES = {
  none: "No preference",
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
} satisfies Record<(typeof MADHABS)[number], string>;

const LIST_STYLE_NAMES = {
  lists: "Lists",
  default: "Default",
  paragraphs: "Paragraphs",
} satisfies Record<(typeof LIST_STYLES)[number], string>;

const LENGTH_NAMES = {
  short: "Short",
  default: "Default",
  detailed: "Detailed",
} satisfies Record<(typeof ANSWER_LENGTHS)[number], string>;

const LANGUAGE_NAMES = {
  auto: "Same as my question",
  en: "English",
  ar: "Arabic",
  fr: "French",
  ur: "Urdu",
  id: "Indonesian",
  tr: "Turkish",
} satisfies Record<(typeof ANSWER_LANGUAGES)[number], string>;

const INSTRUCTIONS_LIMIT = 1500;
const NAME_LIMIT = 80;
const ABOUT_LIMIT = 500;

const field = "border-foreground/10 text-foreground rounded-[12px] border px-3 font-sans text-sm";

export const CustomizeSection: FC = () => {
  const [saved, setSaved] = useState<Settings>();
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [instructions, setInstructions] = useState("");
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    void api.settings.get.query().then(
      (loaded) => {
        setSaved(loaded);
        setName(loaded.name);
        setAbout(loaded.about);
        setInstructions(loaded.instructions);
      },
      () => setFailed(true),
    );
  }, []);

  if (failed) {
    return (
      <Text className="text-muted-foreground font-sans text-sm">Sign in to customize answers.</Text>
    );
  }
  if (!saved) return null;

  const save = (update: Partial<Settings>) => {
    setSaved((current) => current && { ...current, ...update });
    queue.current = queue.current.then(() =>
      api.settings.update.mutate(update).then(
        () => undefined,
        () => undefined,
      ),
    );
  };

  return (
    <>
      <Group title="Answers">
        <Setting label="Answer length" stacked>
          <Segmented
            value={saved.answerLength}
            options={ANSWER_LENGTHS.map((value) => [value, LENGTH_NAMES[value]] as const)}
            onChange={(answerLength) => save({ answerLength })}
          />
        </Setting>
        <Setting label="Headers and lists" stacked>
          <Segmented
            value={saved.listStyle}
            options={LIST_STYLES.map((value) => [value, LIST_STYLE_NAMES[value]] as const)}
            onChange={(listStyle) => save({ listStyle })}
          />
        </Setting>
        <Setting label="Answer language" stacked>
          <Segmented
            value={saved.answerLanguage}
            options={ANSWER_LANGUAGES.map((value) => [value, LANGUAGE_NAMES[value]] as const)}
            onChange={(answerLanguage) => save({ answerLanguage })}
          />
        </Setting>
        <Setting
          label="Show Arabic text"
          hint="Quote verses and hadith in Arabic next to the translation"
        >
          <Toggle value={saved.showArabic} onChange={(showArabic) => save({ showArabic })} />
        </Setting>
      </Group>
      <Group>
        <Setting label="What should Sirathic call you?" stacked>
          <TextInput
            value={name}
            maxLength={NAME_LIMIT}
            onChangeText={setName}
            onBlur={() => {
              if (name.trim() !== saved.name) save({ name: name.trim() });
            }}
            placeholder="Your name"
            placeholderTextColorClassName="accent-muted-foreground"
            className={`${field} h-10`}
          />
        </Setting>
        <Setting label="About you" stacked>
          <TextInput
            value={about}
            maxLength={ABOUT_LIMIT}
            multiline
            onChangeText={setAbout}
            onBlur={() => {
              if (about.trim() !== saved.about) save({ about: about.trim() });
            }}
            placeholder="Your work, your studies, what you already know"
            placeholderTextColorClassName="accent-muted-foreground"
            textAlignVertical="top"
            className={`${field} h-20 py-2.5`}
          />
        </Setting>
        <Setting
          label="Madhab"
          hint="Fiqh answers lead with this school and still show the others"
          stacked
        >
          <Segmented
            value={saved.madhab}
            options={MADHABS.map((value) => [value, MADHAB_NAMES[value]] as const)}
            onChange={(madhab) => save({ madhab })}
          />
        </Setting>
        <Setting label="Custom instructions" stacked>
          <TextInput
            value={instructions}
            maxLength={INSTRUCTIONS_LIMIT}
            multiline
            onChangeText={setInstructions}
            onBlur={() => {
              if (instructions.trim() !== saved.instructions) {
                save({ instructions: instructions.trim() });
              }
            }}
            placeholder="Anything Sirathic should keep in mind, like how much you know or how you like answers"
            placeholderTextColorClassName="accent-muted-foreground"
            textAlignVertical="top"
            className={`${field} h-28 py-2.5`}
          />
          <View className="items-end">
            <Text className="text-muted-foreground font-sans text-[11px]">
              {`${instructions.length} / ${INSTRUCTIONS_LIMIT}`}
            </Text>
          </View>
        </Setting>
      </Group>
    </>
  );
};
