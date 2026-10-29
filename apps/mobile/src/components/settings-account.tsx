import { router } from "expo-router";
import { type FC, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { SIGN_IN_NAMES, useChatState } from "@/lib/chat-state";
import { useConfirm } from "./confirm";
import { User } from "./icons";
import { ActionButton, Group, Setting } from "./settings-controls";
import { useSignIn } from "./sign-in";

type Device = Awaited<ReturnType<typeof api.account.devices.query>>[number];
type Usage = NonNullable<Awaited<ReturnType<typeof api.account.usage.query>>["chatgpt"]>;

const deviceName = ({ device }: Device) => {
  switch (device.kind) {
    case "browser":
      return device.system ? `${device.browser} on ${device.system}` : device.browser;
    case "app":
      return device.system ? `Sirathic app on ${device.system}` : "Sirathic app";
    case "unknown":
      return "Unknown device";
    default: {
      const unknownDevice: never = device;
      return unknownDevice;
    }
  }
};

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  const [count, unit] =
    minutes < 60
      ? [minutes, "minute"]
      : minutes < 1440
        ? [Math.round(minutes / 60), "hour"]
        : [Math.round(minutes / 1440), "day"];
  return count < 1 ? "now" : `${count} ${unit}${count === 1 ? "" : "s"} ago`;
};

const DAY_MS = 86_400_000;

const resetTime = (resetAt: number) =>
  new Intl.DateTimeFormat(
    undefined,
    resetAt - Date.now() < DAY_MS
      ? { hour: "numeric", minute: "2-digit" }
      : { weekday: "short", month: "short", day: "numeric" },
  ).format(resetAt);

const signedOut = () => {
  const { newChat, loadAccount, loadSessions } = useChatState.getState();
  newChat();
  void loadAccount();
  void loadSessions();
  router.navigate("/");
};

const UsageGroup: FC<{ usage: Usage }> = ({ usage }) => (
  <Group title="Usage">
    <View className="flex-row items-center gap-2 py-2">
      <Text className="text-foreground font-medium text-sm">
        {`ChatGPT ${usage.plan.charAt(0).toUpperCase()}${usage.plan.slice(1)}`}
      </Text>
      <Text className="text-super border-foreground/10 rounded-full border px-2 font-sans text-xs">
        GPT answers
      </Text>
    </View>
    {usage.windows.map((window) => (
      <View key={window.seconds} className="gap-1.5 py-2">
        <View className="flex-row justify-between">
          <Text className="text-foreground font-sans text-sm">
            {window.seconds === 604_800
              ? "Weekly limit"
              : `${Math.round(window.seconds / 3600)}-hour limit`}
          </Text>
          <Text className="text-muted-foreground font-sans text-xs">
            {`${Math.round(window.usedPercent)}% used`}
          </Text>
        </View>
        <View className="bg-muted h-1.5 overflow-hidden rounded-full">
          <View
            className="bg-super h-full rounded-full"
            style={{ width: `${Math.min(100, window.usedPercent)}%` }}
          />
        </View>
        <Text className="text-muted-foreground font-sans text-xs">
          {`Resets ${resetTime(window.resetAt)}`}
        </Text>
      </View>
    ))}
  </Group>
);

export const AccountSection: FC = () => {
  const account = useChatState((s) => s.account);
  const ask = useSignIn((s) => s.ask);
  const [devices, setDevices] = useState<Device[]>([]);
  const [usage, setUsage] = useState<Usage>();

  useEffect(() => {
    if (!account?.signedIn) return;
    void api.account.devices.query().then(setDevices, () => undefined);
    void api.account.usage.query().then(
      (found) => setUsage(found.chatgpt ?? undefined),
      () => undefined,
    );
  }, [account?.signedIn]);

  const signOut = async (done: Promise<unknown>) => {
    await done.catch(() => undefined);
    setDevices(await api.account.devices.query().catch(() => devices));
  };

  if (!account?.signedIn) {
    return (
      <Group>
        <Setting label="Not signed in" hint="Sign in to ask and keep your chats">
          <Pressable
            onPress={() => ask()}
            className="bg-primary active:opacity-90 h-8 items-center justify-center rounded-[12px] px-2.5"
          >
            <Text className="text-primary-foreground font-medium text-sm">Sign in</Text>
          </Pressable>
        </Setting>
      </Group>
    );
  }

  return (
    <>
      <Group>
        <View className="flex-row items-center gap-3 py-1">
          {account.image ? (
            <Image source={{ uri: account.image }} className="size-9 rounded-full" />
          ) : (
            <View className="bg-muted size-9 items-center justify-center rounded-full">
              <User size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
            </View>
          )}
          <View className="flex-1">
            <Text numberOfLines={1} className="text-foreground font-sans text-sm">
              {account.label ?? `${SIGN_IN_NAMES[account.via]} account`}
            </Text>
            <Text className="text-muted-foreground font-sans text-xs">
              {`Signed in with ${SIGN_IN_NAMES[account.via]}`}
            </Text>
          </View>
          <ActionButton
            label="Sign out"
            onPress={() => void authClient.signOut().then(signedOut)}
          />
        </View>
      </Group>
      {account.via === "chatgpt" && usage && <UsageGroup usage={usage} />}
      <Group title="Devices">
        {devices.map((device) => (
          <View key={device.id} className="flex-row items-center gap-3 py-2">
            <View className="flex-1">
              <Text className="text-foreground font-sans text-sm">{deviceName(device)}</Text>
              <Text className="text-muted-foreground font-sans text-xs">
                {device.current ? "Active now" : ago(device.lastActive)}
              </Text>
            </View>
            {device.current ? (
              <Text className="text-super font-sans text-xs">This device</Text>
            ) : (
              <ActionButton
                label="Sign out"
                onPress={() => void signOut(api.account.signOutDevice.mutate({ id: device.id }))}
              />
            )}
          </View>
        ))}
        <Setting label="Sign out everywhere else" hint="Every other device has to sign in again">
          <ActionButton
            label="Sign out others"
            onPress={() => void signOut(api.account.signOutOthers.mutate())}
          />
        </Setting>
      </Group>
      <Group>
        <Setting
          label="Delete account"
          hint="Deletes your chats, memory, bots and files, then signs you out"
        >
          <ActionButton
            label="Delete"
            danger
            onPress={() =>
              useConfirm.getState().ask({
                title: "Delete your account and everything in it? This can't be undone.",
                action: "Delete",
                danger: true,
                onConfirm: () =>
                  void api.account.delete
                    .mutate()
                    .then(() => authClient.signOut())
                    .then(signedOut, () => undefined),
              })
            }
          />
        </Setting>
      </Group>
    </>
  );
};
