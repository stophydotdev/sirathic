import type { FC } from "react";
import { Pressable, Text, View } from "react-native";
import { type Attachment, pickFiles, pickPhotos, takePhoto } from "@/lib/attachments";
import { useChatState } from "@/lib/chat-state";
import { At, Camera, Check, Paperclip, Photo, Plus, Telescope } from "./icons";
import { Menu } from "./menu";

const AddRow: FC<{ Icon: typeof Camera; label: string; on?: boolean; onPress: () => void }> = ({
  Icon,
  label,
  on = false,
  onPress,
}) => (
  <Pressable
    accessibilityRole="menuitem"
    accessibilityState={{ checked: on }}
    onPress={onPress}
    className="h-13 flex-row items-center gap-3 rounded-xl px-1.5 active:bg-foreground/8"
  >
    <View className="bg-foreground/10 size-9 items-center justify-center rounded-full">
      <Icon size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
    </View>
    <Text className="text-foreground font-medium flex-1 text-base">{label}</Text>
    {on && <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />}
  </Pressable>
);

export const AddMenu: FC<{
  modes: boolean;
  onAttach: (files: Attachment[]) => void;
  onPlugins: () => void;
}> = ({ modes, onAttach, onPlugins }) => {
  const research = useChatState((s) => s.mode === "research");
  const setMode = useChatState((s) => s.setMode);
  return (
    <Menu
      label="Add files or tools"
      overKeyboard
      triggerClassName="active:bg-muted size-10 items-center justify-center rounded-full"
      contentClassName="w-64"
      trigger={<Plus size={24} strokeWidth={1.75} colorClassName="accent-foreground" />}
    >
      {(close) => {
        const attachFrom = (pick: () => Promise<Attachment[]>) => () => {
          close();
          void pick().then(onAttach);
        };
        return (
          <>
            <AddRow Icon={Camera} label="Camera" onPress={attachFrom(takePhoto)} />
            <AddRow Icon={Photo} label="Photos" onPress={attachFrom(pickPhotos)} />
            <AddRow Icon={Paperclip} label="Files" onPress={attachFrom(pickFiles)} />
            <AddRow
              Icon={At}
              label="Plugins"
              onPress={() => {
                close();
                onPlugins();
              }}
            />
            {modes && (
              <AddRow
                Icon={Telescope}
                label="Research"
                on={research}
                onPress={() => {
                  close();
                  setMode(research ? "quick" : "research");
                }}
              />
            )}
          </>
        );
      }}
    </Menu>
  );
};
