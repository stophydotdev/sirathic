import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { type FC, useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { z } from "zod";
import { create } from "zustand";
import { authClient } from "@/lib/auth";
import { useChatState } from "@/lib/chat-state";
import { ArrowUpRight, X } from "./icons";
import { MakerIcon } from "./maker-icon";
import { Mark } from "./mark";
import { Dim, Pop } from "./motion";

export const useSignIn = create<{
  open: boolean;
  ask: () => void;
  close: () => void;
}>()((set) => ({
  open: false,
  ask: () => set({ open: true }),
  close: () => set({ open: false }),
}));

const deviceCode = z.object({
  userCode: z.string(),
  intervalMs: z.number(),
  verificationUrl: z.url(),
});

const devicePoll = z.object({
  status: z.enum(["pending", "expired", "signed-in"]),
});

type Step =
  | { kind: "start" }
  | { kind: "asking" }
  | ({ kind: "code" } & z.infer<typeof deviceCode>)
  | { kind: "expired" }
  | { kind: "failed"; message: string };

const START: Step = { kind: "start" };

const TITLES = {
  start: "Sign in to Sirathic",
  asking: "Sign in to Sirathic",
  code: "Enter this code on ChatGPT",
  expired: "Code expired",
  failed: "Sign-in didn't work",
} satisfies Record<Step["kind"], string>;

const button = "h-10 w-full flex-row items-center justify-center gap-2 rounded-[10px]";
const primary = `${button} bg-primary active:opacity-90`;
const secondary = `${button} bg-muted active:bg-foreground/10`;
const primaryText = "text-primary-foreground font-medium text-sm";
const secondaryText = "text-foreground font-medium text-sm";

const signedIn = async () => {
  authClient.$store.notify("$sessionSignal");
  const { loadAccount, loadSessions } = useChatState.getState();
  await Promise.all([loadAccount(), loadSessions()]);
  useSignIn.getState().close();
};

const GoogleIcon: FC = () => (
  <Svg viewBox="0 0 48 48" width={16} height={16}>
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </Svg>
);

const CodeCells: FC<{ code: string }> = ({ code }) => (
  <View accessibilityLabel={code} className="flex-row items-center gap-[3px]">
    {[...code].map((char, index) =>
      char === "-" ? (
        <View key={`${index}-dash`} className="bg-muted-foreground/50 mx-0.5 h-px w-2" />
      ) : (
        <View
          key={`${index}-${char}`}
          className="bg-muted border-border h-9 w-6 items-center justify-center rounded-md border"
        >
          <Text className="text-foreground font-medium text-lg">{char}</Text>
        </View>
      ),
    )}
  </View>
);

export const SignInSheet: FC = () => {
  const open = useSignIn((s) => s.open);
  const close = useSignIn((s) => s.close);
  const [step, setStep] = useState<Step>(START);
  const [help, setHelp] = useState(false);

  const dismiss = () => {
    close();
    setStep(START);
    setHelp(false);
  };

  const withGoogle = async () => {
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (error) setStep({ kind: "failed", message: error.message ?? "Google sign-in failed" });
    else await signedIn();
  };

  const getCode = async () => {
    setStep({ kind: "asking" });
    const { data, error } = await authClient.$fetch("/chatgpt/start", { method: "POST" });
    const code = deviceCode.safeParse(data);
    if (error || !code.success) {
      setStep({ kind: "failed", message: error?.message ?? "ChatGPT sign-in didn't start" });
      return;
    }
    setStep({ kind: "code", ...code.data });
  };

  useEffect(() => {
    if (step.kind !== "code") return;
    let stopped = false;
    const poll = async () => {
      const { data, error } = await authClient.$fetch("/chatgpt/poll");
      const status = devicePoll.safeParse(data).data?.status;
      if (stopped) return;
      if (status === "signed-in") {
        await signedIn();
        setStep(START);
      } else if (status === "expired") setStep({ kind: "expired" });
      else if (status === "pending") timer = setTimeout(poll, step.intervalMs);
      else setStep({ kind: "failed", message: error?.message ?? "Sign-in didn't work" });
    };
    let timer = setTimeout(poll, step.intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [step]);

  return (
    <Modal
      visible={open}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onRequestClose={dismiss}
    >
      <View className="flex-1 items-center justify-center px-4">
        <Dim />
        <Pressable accessibilityLabel="Close" onPress={dismiss} className="absolute inset-0" />
        <Pop className="bg-background border-border w-full max-w-[360px] items-center gap-5 rounded-[14px] border px-[26px] pt-[34px] pb-[22px]">
          <Pressable
            accessibilityLabel="Close"
            onPress={dismiss}
            className="absolute end-3 top-3 size-7 items-center justify-center rounded-full"
          >
            <X size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
          </Pressable>
          <Mark size={26} />
          <Text className="text-foreground font-medium text-center text-base tracking-[-0.01em]">
            {TITLES[step.kind]}
          </Text>
          {step.kind === "code" ? (
            <>
              <CodeCells code={step.userCode} />
              <Pressable
                onPress={() => {
                  void Clipboard.setStringAsync(step.userCode);
                  void WebBrowser.openBrowserAsync(step.verificationUrl);
                }}
                className={primary}
              >
                <Text className={primaryText}>Copy code and open ChatGPT</Text>
                <ArrowUpRight
                  size={18}
                  strokeWidth={1.75}
                  colorClassName="accent-primary-foreground"
                />
              </Pressable>
              <View className="flex-row items-center gap-2">
                <View className="bg-super border-super/20 size-2.5 rounded-full border-[3px]" />
                <Text className="text-muted-foreground font-sans text-xs">
                  Waiting for you to approve it on ChatGPT
                </Text>
              </View>
              {help ? (
                <Text className="text-muted-foreground border-border font-sans w-full border-t pt-3.5 text-center text-xs leading-normal">
                  First time? Turn on device code sign-in in ChatGPT → Settings → Security. ChatGPT
                  will say Codex, that's expected.
                </Text>
              ) : (
                <Pressable onPress={() => setHelp(true)}>
                  <Text className="text-super font-sans text-xs">Code not accepted?</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              {step.kind === "failed" && (
                <Text className="text-muted-foreground font-sans text-center text-sm">
                  {step.message}
                </Text>
              )}
              {step.kind === "start" || step.kind === "asking" ? (
                <View className="w-full items-center gap-2">
                  <Text className="text-muted-foreground font-sans -mt-3 mb-1 text-center text-sm">
                    Islamic answering engine. Free.
                  </Text>
                  <Pressable onPress={() => void withGoogle()} className={primary}>
                    <GoogleIcon />
                    <Text className={primaryText}>Continue with Google</Text>
                  </Pressable>
                  <Pressable
                    disabled={step.kind === "asking"}
                    onPress={() => void getCode()}
                    className={`${secondary} ${step.kind === "asking" ? "opacity-60" : ""}`}
                  >
                    <MakerIcon maker="openai" size={16} colorClassName="accent-foreground" />
                    <Text className={secondaryText}>Continue with ChatGPT</Text>
                  </Pressable>
                  <Text className="text-muted-foreground font-sans text-center text-xs">
                    ChatGPT lets you answer with GPT models on your own plan.
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={step.kind === "expired" ? () => void getCode() : () => setStep(START)}
                  className={primary}
                >
                  <Text className={primaryText}>
                    {step.kind === "expired" ? "Get a new code" : "Try again"}
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </Pop>
      </View>
    </Modal>
  );
};
