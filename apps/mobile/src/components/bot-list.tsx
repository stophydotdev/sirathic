import { botGroups, botLabel, SIDEBAR_LIMIT } from "@sirathic/app/botGroups";
import { useGlobalSearchParams } from "expo-router";
import { type FC, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { type Bot, useBots } from "@/lib/bots";
import { useChatState } from "@/lib/chat-state";
import { BotAvatar } from "./bot-avatar";
import { BotMenu } from "./bot-menu";
import { BotSwitcher, openBot } from "./bot-switcher";
import { Fold, Turn } from "./motion";
import { ChevronDown, Plus } from "./icons";

const DAY_MS = 86_400_000;
const WORKING_POLL_MS = 10_000;

const dayStart = (at: Date) => new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();

const whenOf = (iso: string) => {
  const at = new Date(iso);
  const days = Math.round((dayStart(new Date()) - dayStart(at)) / DAY_MS);
  if (days <= 0) {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(at);
  }
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(at);
};

const toggleLink = "text-muted-foreground font-sans ps-2.5 text-xs";

const BotRow: FC<{ bot: Bot; onOpen: () => void }> = ({ bot, onOpen }) => {
  const session = useChatState((s) => s.sessions?.find((found) => found.id === bot.id));
  const current = useGlobalSearchParams<{ id?: string }>().id === bot.id;
  const unread = session?.unread;

  return (
    <View className={`rounded-xl ${current ? "bg-muted" : ""}`}>
      <Pressable
        onPress={() => {
          openBot(bot.id);
          onOpen();
        }}
        className="active:bg-muted flex-row items-center gap-2.5 rounded-xl px-2.5 py-2"
      >
        <BotAvatar
          color={bot.color}
          body={bot.symbol}
          seed={bot.id}
          state={bot.hidden ? "paused" : session?.working ? "thinking" : "ready"}
          size={40}
        />
        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text
              numberOfLines={1}
              className={`text-foreground flex-1 text-base ${unread ? "font-medium" : "font-sans"}`}
            >
              {botLabel(bot)}
            </Text>
            {session && (
              <Text className="text-muted-foreground font-sans text-xs">
                {whenOf(session.updatedAt)}
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-2 pe-6">
            <Text numberOfLines={1} className="text-muted-foreground font-sans flex-1 text-xs">
              {session ? session.preview : bot.greeting}
            </Text>
            {unread && <View className="bg-super size-1.5 rounded-full" />}
          </View>
        </View>
      </Pressable>
      <View className="absolute end-2 bottom-2">
        <BotMenu
          bot={bot}
          onDone={onOpen}
          triggerClassName="active:bg-foreground/10 size-7 items-center justify-center rounded-full"
        />
      </View>
    </View>
  );
};

export const BotList: FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const signedIn = useChatState((s) => s.account?.signedIn === true);
  const bots = useBots((s) => s.bots);
  const anyWorking = useChatState((s) => s.sessions?.some((session) => session.working));
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!anyWorking) return;
    const timer = setInterval(() => void useChatState.getState().loadSessions(), WORKING_POLL_MS);
    return () => clearInterval(timer);
  }, [anyWorking]);

  if (!signedIn) return null;

  const { groups, hidden, more } = botGroups(bots ?? [], all ? Infinity : SIDEBAR_LIMIT);

  return (
    <>
      <View className="flex-row items-center gap-1 ps-2.5 pt-6 pb-1">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
          className="flex-1 flex-row items-center gap-1"
        >
          <Text className="text-muted-foreground font-sans text-sm">Bots</Text>
          <Turn turned={!open} degrees={-90}>
            <ChevronDown size={18} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
          </Turn>
        </Pressable>
        <Pressable
          accessibilityLabel="Search or create bots"
          onPress={() => setPicking(true)}
          className="active:bg-muted me-1 size-9 items-center justify-center rounded-full"
        >
          <Plus size={22} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        </Pressable>
      </View>
      <Fold open={open}>
        <View className="gap-0.5">
          {groups.map((group, index) => (
            <View
              key={group.kind === "section" ? `section:${group.name}` : group.kind}
              className={index > 0 ? "pt-2" : undefined}
            >
              {group.kind === "pinned" && (
                <Text className="text-muted-foreground font-sans ps-2.5 pt-1 pb-0.5 text-xs">
                  Pinned
                </Text>
              )}
              {group.kind === "section" && (
                <Text
                  numberOfLines={1}
                  className="text-muted-foreground font-sans ps-2.5 pt-1 pb-0.5 text-xs"
                >
                  {group.name}
                </Text>
              )}
              {group.bots.map((bot) => (
                <BotRow key={bot.id} bot={bot} onOpen={onOpen} />
              ))}
            </View>
          ))}
          {more > 0 && (
            <Pressable onPress={() => setAll(true)} className="py-1">
              <Text className={toggleLink}>Show more</Text>
            </Pressable>
          )}
          {hidden.length > 0 && (
            <>
              <Pressable
                accessibilityState={{ expanded: showHidden }}
                onPress={() => setShowHidden(!showHidden)}
                className="pt-2 pb-1"
              >
                <Text className={toggleLink}>{`Hidden bots (${hidden.length})`}</Text>
              </Pressable>
              <Fold open={showHidden}>
                {hidden.map((bot) => (
                  <BotRow key={bot.id} bot={bot} onOpen={onOpen} />
                ))}
              </Fold>
            </>
          )}
        </View>
      </Fold>
      <BotSwitcher
        open={picking}
        onClose={() => {
          setPicking(false);
          onOpen();
        }}
      />
    </>
  );
};
