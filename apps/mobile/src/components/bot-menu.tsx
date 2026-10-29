import { sectionNames } from "@sirathic/app/botGroups";
import { SECTION_NAME_MAX } from "@sirathic/server/projects";
import { type FC, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { create } from "zustand";
import { api } from "@/lib/api";
import { type Bot, useBots } from "@/lib/bots";
import { useChatState } from "@/lib/chat-state";
import { openBot } from "./bot-switcher";
import { useConfirm } from "./confirm";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Dots,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  Mail,
  MailOpened,
  Pin,
  PinnedOff,
  Trash,
  UserEdit,
} from "./icons";
import { Menu, menuRow, menuText } from "./menu";

export const useBotPanel = create<{ open: boolean; setOpen: (open: boolean) => void }>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const Item: FC<{ label: string; Icon: typeof Pin; danger?: boolean; onPress: () => void }> = ({
  label,
  Icon,
  danger = false,
  onPress,
}) => (
  <Pressable onPress={onPress} className={menuRow}>
    <Icon
      size={20}
      strokeWidth={1.75}
      colorClassName={danger ? "accent-destructive" : "accent-foreground"}
    />
    <Text className={`${danger ? "text-destructive font-sans text-sm" : menuText} flex-1`}>
      {label}
    </Text>
  </Pressable>
);

const Divider: FC = () => <View className="bg-foreground/8 my-1 h-px" />;

export const BotMenu: FC<{
  bot: Bot;
  triggerClassName: string;
  iconSize?: number;
  onDone?: () => void;
}> = ({ bot, triggerClassName, iconSize = 18, onDone }) => {
  const bots = useBots((s) => s.bots) ?? [];
  const change = useBots((s) => s.change);
  const session = useChatState((s) => s.sessions?.find((found) => found.id === bot.id));
  const [moving, setMoving] = useState(false);

  return (
    <Menu
      label="More actions"
      align="end"
      trigger={<Dots size={iconSize} strokeWidth={1.75} colorClassName="accent-muted-foreground" />}
      triggerClassName={triggerClassName}
      contentClassName="w-60"
    >
      {(close) => {
        const then = (action: () => void) => () => {
          close();
          setMoving(false);
          action();
        };
        if (moving) {
          return (
            <>
              <Pressable onPress={() => setMoving(false)} className={menuRow}>
                <ChevronLeft
                  size={20}
                  strokeWidth={1.75}
                  colorClassName="accent-muted-foreground"
                />
                <Text className="text-muted-foreground font-sans text-sm">Move to</Text>
              </Pressable>
              {[...sectionNames(bots), null].map((section) => (
                <Pressable
                  key={section ?? "none"}
                  onPress={then(() => void change(bot.id, { section }))}
                  className={menuRow}
                >
                  <Text numberOfLines={1} className={`${menuText} flex-1`}>
                    {section ?? "No section"}
                  </Text>
                  {bot.section === section && (
                    <Check size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
                  )}
                </Pressable>
              ))}
            </>
          );
        }
        return (
          <>
            <Item
              label={bot.pinned ? "Unpin" : "Pin"}
              Icon={bot.pinned ? PinnedOff : Pin}
              onPress={then(() => void change(bot.id, { pinned: !bot.pinned }))}
            />
            <Pressable onPress={() => setMoving(true)} className={menuRow}>
              <Folder size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
              <Text className={`${menuText} flex-1`}>Move to</Text>
              <ChevronRight size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
            </Pressable>
            <Item
              label="Move to new section"
              Icon={FolderPlus}
              onPress={then(() =>
                useConfirm.getState().ask({
                  title: "Move to new section",
                  action: "Save",
                  field: { maxLength: SECTION_NAME_MAX },
                  onConfirm: (section) => void change(bot.id, { section }),
                }),
              )}
            />
            {session && (
              <Item
                label={session.unread ? "Mark as read" : "Mark as unread"}
                Icon={session.unread ? MailOpened : Mail}
                onPress={then(
                  () =>
                    void api.sessions.update
                      .mutate({ id: session.id, unread: !session.unread })
                      .then(
                        () => useChatState.getState().loadSessions(),
                        () => undefined,
                      ),
                )}
              />
            )}
            <Divider />
            <Item
              label="Edit profile"
              Icon={UserEdit}
              onPress={then(() => {
                onDone?.();
                openBot(bot.id);
                useBotPanel.getState().setOpen(true);
              })}
            />
            <Divider />
            <Item
              label={bot.hidden ? "Unhide" : "Hide from sidebar"}
              Icon={bot.hidden ? Eye : EyeOff}
              onPress={then(() => void change(bot.id, { hidden: !bot.hidden }))}
            />
            <Item
              label="Delete"
              Icon={Trash}
              danger
              onPress={then(() =>
                useConfirm.getState().ask({
                  title: `Delete “${bot.name}”?`,
                  body: "This permanently deletes the bot and its chat history. This can't be undone.",
                  action: "Delete",
                  danger: true,
                  onConfirm: () => void useBots.getState().remove(bot.id),
                }),
              )}
            />
          </>
        );
      }}
    </Menu>
  );
};
