import { type Draft, draftOf, sameDraft } from "@sirathic/app/customize";
import { MADHABS } from "@sirathic/server/settings";
import { type FC, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { Group, Segmented, Setting } from "./settings-controls";

export const MADHAB_NAMES = {
  none: "No preference",
  hanafi: "Hanafi",
  maliki: "Maliki",
  shafii: "Shafi'i",
  hanbali: "Hanbali",
} satisfies Record<(typeof MADHABS)[number], string>;

const INSTRUCTIONS_LIMIT = 1500;
const NAME_LIMIT = 80;
const ABOUT_LIMIT = 500;

const field = "border-foreground/10 text-foreground rounded-[12px] border px-3 font-sans text-sm";

export const CustomizeSection: FC = () => {
  const [saved, setSaved] = useState<Draft>();
  const [draft, setDraft] = useState<Draft>();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void api.settings.get.query().then(
      (loaded) => {
        setSaved(draftOf(loaded));
        setDraft(draftOf(loaded));
      },
      () => setFailed(true),
    );
  }, []);

  if (failed) {
    return (
      <Text className="text-muted-foreground font-sans text-sm">Sign in to customize answers.</Text>
    );
  }
  if (!saved || !draft) return null;

  const changed = !sameDraft(draft, saved);
  const edit = (update: Partial<Draft>) => setDraft({ ...draft, ...update });
  const save = () => {
    const next = draftOf(draft);
    setSaving(true);
    void api.settings.update.mutate(next).then(
      () => {
        setSaved(next);
        setDraft(next);
        setSaving(false);
      },
      () => setSaving(false),
    );
  };

  return (
    <Group>
      <Setting label="What should Sirathic call you?" stacked>
        <TextInput
          value={draft.name}
          maxLength={NAME_LIMIT}
          onChangeText={(name) => edit({ name })}
          placeholder="Your name"
          placeholderTextColorClassName="accent-muted-foreground"
          className={`${field} h-10`}
        />
      </Setting>
      <Setting label="About you" stacked>
        <TextInput
          value={draft.about}
          maxLength={ABOUT_LIMIT}
          multiline
          onChangeText={(about) => edit({ about })}
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
          value={draft.madhab}
          options={MADHABS.map((value) => [value, MADHAB_NAMES[value]] as const)}
          onChange={(madhab) => edit({ madhab })}
        />
      </Setting>
      <Setting label="Custom instructions" stacked>
        <TextInput
          value={draft.instructions}
          maxLength={INSTRUCTIONS_LIMIT}
          multiline
          onChangeText={(instructions) => edit({ instructions })}
          placeholder="Anything Sirathic should keep in mind, like how much you know or how you like answers"
          placeholderTextColorClassName="accent-muted-foreground"
          textAlignVertical="top"
          className={`${field} h-28 py-2.5`}
        />
        <View className="items-end">
          <Text className="text-muted-foreground font-sans text-[11px]">
            {`${draft.instructions.length} / ${INSTRUCTIONS_LIMIT}`}
          </Text>
        </View>
      </Setting>
      <View className="items-end pt-1">
        <Pressable
          accessibilityRole="button"
          disabled={!changed || saving}
          onPress={save}
          className={`h-9 justify-center rounded-full px-4 ${changed ? "bg-primary active:opacity-90" : "bg-muted"}`}
        >
          <Text
            className={`font-sans text-sm font-medium ${changed ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            {changed ? "Save" : "Saved"}
          </Text>
        </Pressable>
      </View>
    </Group>
  );
};
