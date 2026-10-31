import { type Href, router } from "expo-router";
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { type FC, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { authClient } from "@/lib/auth";
import { BotList } from "./bot-list";
import { SearchChats } from "./search-chats";
import { SIGN_IN_NAMES, useChatState } from "@/lib/chat-state";
import {
  At,
  Books,
  ChevronDown,
  ChevronRight,
  Clock,
  ListCheck,
  Logout,
  Plus,
  Search,
  Settings,
  Spy,
  UserCircle,
} from "./icons";
import { Mark } from "./mark";
import { Fold, Turn } from "./motion";
import { Menu, menuRow, menuText } from "./menu";
import { useSignIn } from "./sign-in";

const navRow = "h-12 flex-row items-center gap-3 rounded-xl px-2.5 active:bg-muted";
const accountRow = "h-12 w-full flex-row items-center gap-3 rounded-[12px] px-2.5 active:bg-muted";

const PAGES = [
  ["/library", "Library", Books],
  ["/automations", "Automations", Clock],
  ["/tasks", "Tasks", ListCheck],
  ["/plugins", "Plugins", At],
] as const satisfies readonly (readonly [Href, string, typeof Books])[];

const RECENT_LIMIT = 4;

const Recents: FC<{ onOpen: () => void; onSeeAll: () => void }> = ({ onOpen, onSeeAll }) => {
  const sessions = useChatState((s) => s.sessions);
  const current = useChatState((s) => (s.saved ? s.chatId : undefined));
  const open = useChatState((s) => s.open);
  const [shown, setShown] = useState(true);
  const chats = sessions?.filter((session) => !session.projectId) ?? [];
  const ordered = [
    ...chats.filter((session) => session.pinned),
    ...chats.filter((session) => !session.pinned),
  ];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        onPress={() => setShown(!shown)}
        className="flex-row items-center justify-between px-2.5 pt-6 pb-1"
      >
        <Text className="text-muted-foreground font-sans text-sm">Chats</Text>
        <Turn turned={!shown} degrees={-90}>
          <ChevronDown size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        </Turn>
      </Pressable>
      <Fold open={shown}>
        {sessions !== undefined && chats.length === 0 && (
          <Text className="text-muted-foreground/70 font-sans px-2.5 py-1.5 text-sm">
            No chats yet
          </Text>
        )}
        {ordered.slice(0, RECENT_LIMIT).map((session) => (
          <Pressable
            key={session.id}
            onPress={() => {
              open(session.id);
              router.navigate("/");
              onOpen();
            }}
            className={`flex-row items-center rounded-[12px] pe-2 active:bg-muted ${current === session.id ? "bg-muted" : ""}`}
          >
            <Text
              numberOfLines={1}
              className={`text-foreground flex-1 px-2.5 py-3 text-base ${session.unread ? "font-medium" : "font-sans"}`}
            >
              {session.title}
            </Text>
            {session.working ? (
              <ActivityIndicator
                size="small"
                accessibilityLabel="Working"
                colorClassName="accent-muted-foreground"
              />
            ) : (
              session.unread && <View className="bg-super me-2 size-1.5 rounded-full" />
            )}
          </Pressable>
        ))}
        {ordered.length > RECENT_LIMIT && (
          <Pressable onPress={onSeeAll} className="active:bg-muted rounded-[12px] px-2.5 py-3">
            <Text className="text-muted-foreground font-medium text-base">See all</Text>
          </Pressable>
        )}
      </Fold>
    </>
  );
};

const AccountRow: FC<{ onDone: () => void }> = ({ onDone }) => {
  const account = useChatState((s) => s.account);
  const incognito = useChatState((s) => s.incognito);
  const setIncognito = useChatState((s) => s.setIncognito);
  const ask = useSignIn((s) => s.ask);

  if (account === undefined) return <View className="h-10" />;
  if (!account.signedIn) {
    return (
      <Pressable
        onPress={() => {
          onDone();
          ask();
        }}
        className={accountRow}
      >
        <UserCircle size={24} strokeWidth={1.5} colorClassName="accent-foreground" />
        <Text className="text-foreground font-medium flex-1 text-base">Sign In</Text>
        <ChevronRight size={18} strokeWidth={1.75} colorClassName="accent-super" />
      </Pressable>
    );
  }

  return (
    <Menu
      label="Account menu"
      triggerClassName={accountRow}
      contentClassName="w-64"
      trigger={
        <>
          {account.image ? (
            <Image source={{ uri: account.image }} className="size-8 rounded-full" />
          ) : (
            <View className="border-border size-8 items-center justify-center rounded-full border bg-black">
              <Mark size={20} colorClassName="accent-white" />
            </View>
          )}
          <Text numberOfLines={1} className="text-foreground font-medium flex-1 text-base">
            {account.label ?? `${SIGN_IN_NAMES[account.via]} account`}
          </Text>
        </>
      }
    >
      {(close) => (
        <>
          <View className="gap-0.5 px-2.5 py-2">
            <Text className="text-foreground font-medium text-sm">{account.label}</Text>
            <Text className="text-muted-foreground font-sans text-xs">
              {`${SIGN_IN_NAMES[account.via]} account`}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setIncognito(!incognito);
              close();
            }}
            className={menuRow}
          >
            <Spy size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
            <Text className={`${menuText} flex-1`}>Incognito</Text>
            {incognito && <View className="bg-super size-1.5 rounded-full" />}
          </Pressable>
          <Pressable
            onPress={() => {
              close();
              onDone();
              router.navigate("/settings");
            }}
            className={menuRow}
          >
            <Settings size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
            <Text className={menuText}>All settings</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              close();
              onDone();
              void authClient.signOut().then(() => {
                const { newChat, loadAccount, loadSessions } = useChatState.getState();
                newChat();
                void loadAccount();
                void loadSessions();
              });
            }}
            className={menuRow}
          >
            <Logout size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
            <Text className={menuText}>Sign out</Text>
          </Pressable>
        </>
      )}
    </Menu>
  );
};

export const DrawerPanel: FC<DrawerContentComponentProps> = ({ navigation }) => {
  const newChat = useChatState((s) => s.newChat);
  const [searching, setSearching] = useState(false);
  const close = () => navigation.closeDrawer();

  return (
    <View className="bg-sidebar pt-safe pb-safe flex-1">
      <View className="h-14 flex-row items-center px-4">
        <Mark size={24} />
      </View>
      <ScrollView contentContainerClassName="gap-0.5 px-2">
        <Pressable
          onPress={() => {
            newChat();
            router.navigate("/");
            close();
          }}
          className={navRow}
        >
          <Plus size={24} strokeWidth={1.75} colorClassName="accent-foreground" />
          <Text className="text-foreground font-sans text-base">New</Text>
        </Pressable>
        {PAGES.map(([href, label, Icon]) => (
          <Pressable
            key={href}
            onPress={() => {
              router.navigate(href);
              close();
            }}
            className={navRow}
          >
            <Icon size={24} strokeWidth={1.75} colorClassName="accent-foreground" />
            <Text className="text-foreground font-sans text-base">{label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setSearching(true)} className={navRow}>
          <Search size={24} strokeWidth={1.75} colorClassName="accent-foreground" />
          <Text className="text-foreground font-sans text-base">Search chats</Text>
        </Pressable>
        <BotList onOpen={close} />
        <Recents onOpen={close} onSeeAll={() => setSearching(true)} />
      </ScrollView>
      <View className="p-2">
        <AccountRow onDone={close} />
      </View>
      <SearchChats
        open={searching}
        onClose={() => {
          setSearching(false);
          close();
        }}
      />
    </View>
  );
};
