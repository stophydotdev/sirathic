import { type Draft, isComplete, scheduleOf } from "@sirathic/app/automationDraft";
import { type FC, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/lib/api";
import { type Automation, localZone } from "@/lib/automations";
import { dialogButton } from "./confirm";
import { X } from "./icons";
import { Dim, Pop } from "./motion";
import { IconGrid, ProjectIcon } from "./project-icon";
import { TriggerField } from "./trigger-field";

const field = "bg-foreground/8 text-foreground rounded-[10px] px-3 font-sans text-sm";

const Heading: FC<{ children: string }> = ({ children }) => (
  <Text className="text-muted-foreground font-medium text-xs">{children}</Text>
);

export const AutomationEditor: FC<{
  automation: Automation | undefined;
  draft: Draft;
  botId?: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ automation, draft: initial, botId, onClose, onSaved }) => {
  const [draft, setDraft] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState<"delete" | "discard">();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const change = (update: Partial<Draft>) => setDraft((current) => ({ ...current, ...update }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const plan = scheduleOf(draft);
  const ready =
    plan !== undefined && isComplete(draft) && !busy && (automation === undefined || dirty);

  const run = async <Result,>(work: () => Promise<Result>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const save = () => {
    if (!plan || !ready) return;
    const input = {
      name: draft.name,
      prompt: draft.prompt,
      icon: draft.icon,
      schedule: plan,
      timezone: localZone(),
    };
    void run(() =>
      automation
        ? api.automations.update.mutate({ id: automation.id, ...input })
        : api.automations.create.mutate({ ...input, projectId: botId }),
    );
  };

  const leave = () => (dirty ? setAsking("discard") : onClose());

  return (
    <Modal visible transparent animationType="none" onRequestClose={leave}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <Pressable onPress={leave} className="flex-1 justify-center px-4">
          <Dim />
          <Pop className="max-h-full w-full">
            <Pressable className="bg-surface border-foreground/7 max-h-full w-full rounded-[20px] border shadow-lg">
              <ScrollView contentContainerClassName="gap-4 p-5" keyboardShouldPersistTaps="handled">
                <View className="flex-row items-center justify-between">
                  <Text className="text-foreground font-medium text-base">
                    {automation ? "Edit automation" : "New automation"}
                  </Text>
                  <Pressable
                    accessibilityLabel="Close"
                    onPress={leave}
                    className="active:bg-muted -me-2 size-8 items-center justify-center rounded-full"
                  >
                    <X size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
                  </Pressable>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable
                    accessibilityLabel="Pick new icon"
                    onPress={() => setPicking(!picking)}
                    className={`size-9 items-center justify-center rounded-[10px] ${picking ? "bg-foreground/15" : "bg-foreground/8"}`}
                  >
                    <ProjectIcon icon={draft.icon} />
                  </Pressable>
                  <TextInput
                    value={draft.name}
                    onChangeText={(name) => change({ name })}
                    placeholder="Morning reminder"
                    placeholderTextColorClassName="accent-muted-foreground"
                    accessibilityLabel="Name"
                    maxLength={60}
                    className={`${field} h-9 flex-1`}
                  />
                </View>
                {picking && (
                  <IconGrid
                    icon={draft.icon}
                    onPick={(icon) => {
                      change({ icon });
                      setPicking(false);
                    }}
                  />
                )}
                <View className="gap-2">
                  <Heading>Trigger</Heading>
                  <TriggerField draft={draft} change={change} />
                </View>
                <View className="gap-2">
                  <Heading>Instructions</Heading>
                  <TextInput
                    value={draft.prompt}
                    onChangeText={(prompt) => change({ prompt })}
                    placeholder="What should Noor answer each time?"
                    placeholderTextColorClassName="accent-muted-foreground"
                    multiline
                    maxLength={4000}
                    textAlignVertical="top"
                    className={`${field} min-h-20 rounded-[14px] px-5 py-4 leading-5`}
                  />
                </View>
                {error && <Text className="text-destructive font-sans text-sm">{error}</Text>}
                {asking === "delete" && automation ? (
                  <View className="flex-row flex-wrap items-center justify-end gap-2">
                    <Text className="text-muted-foreground font-sans me-auto text-sm">
                      Delete this automation?
                    </Text>
                    <Pressable
                      onPress={() => setAsking(undefined)}
                      className={`${dialogButton} border-border border`}
                    >
                      <Text className="text-foreground font-medium text-sm">Cancel</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() =>
                        void run(() => api.automations.remove.mutate({ id: automation.id }))
                      }
                      className={`${dialogButton} bg-destructive`}
                    >
                      <Text className="font-medium text-sm text-white">Delete</Text>
                    </Pressable>
                  </View>
                ) : asking === "discard" ? (
                  <View className="flex-row flex-wrap items-center justify-end gap-2">
                    <Text className="text-muted-foreground font-sans me-auto text-sm">
                      Discard unsaved changes?
                    </Text>
                    <Pressable
                      onPress={() => setAsking(undefined)}
                      className={`${dialogButton} bg-foreground/8`}
                    >
                      <Text className="text-foreground font-medium text-sm">Keep editing</Text>
                    </Pressable>
                    <Pressable onPress={onClose} className={`${dialogButton} bg-primary`}>
                      <Text className="text-primary-foreground font-medium text-sm">Discard</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="flex-row items-center justify-end gap-2">
                    {automation && (
                      <Pressable
                        onPress={() => setAsking("delete")}
                        className={`${dialogButton} bg-foreground/8 me-auto`}
                      >
                        <Text className="text-destructive font-medium text-sm">Delete</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={leave} className={`${dialogButton} bg-foreground/8`}>
                      <Text className="text-foreground font-medium text-sm">Cancel</Text>
                    </Pressable>
                    <Pressable
                      disabled={!ready}
                      onPress={save}
                      className={`${dialogButton} bg-primary ${ready ? "active:opacity-85" : "opacity-60"}`}
                    >
                      <Text className="text-primary-foreground font-medium text-sm">Save</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pop>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
