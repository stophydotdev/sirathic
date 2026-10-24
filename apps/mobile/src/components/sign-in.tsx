import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { type FC, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { authClient } from "@/lib/auth";
import { colors } from "@/theme";

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
  | { kind: "waiting" }
  | ({ kind: "code" } & z.infer<typeof deviceCode>)
  | { kind: "failed"; message: string };

const refreshSession = () => authClient.$store.notify("$sessionSignal");

export const SignIn: FC = () => {
  const [step, setStep] = useState<Step>({ kind: "start" });

  const withGoogle = async () => {
    setStep({ kind: "waiting" });
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
    if (error)
      setStep({
        kind: "failed",
        message: error.message ?? "Google sign-in failed",
      });
    else refreshSession();
  };

  const withChatGPT = async () => {
    setStep({ kind: "waiting" });
    const { data, error } = await authClient.$fetch("/chatgpt/start", {
      method: "POST",
    });
    const code = deviceCode.safeParse(data);
    if (error || !code.success) {
      setStep({ kind: "failed", message: "ChatGPT sign-in didn't start" });
      return;
    }
    setStep({ kind: "code", ...code.data });
    await WebBrowser.openBrowserAsync(code.data.verificationUrl);
  };

  useEffect(() => {
    if (step.kind !== "code") return;
    let stopped = false;
    const poll = async () => {
      const { data } = await authClient.$fetch("/chatgpt/poll");
      const status = devicePoll.safeParse(data).data?.status;
      if (stopped) return;
      if (status === "signed-in") refreshSession();
      else if (status === "expired") setStep({ kind: "failed", message: "Code expired" });
      else timer = setTimeout(poll, step.intervalMs);
    };
    let timer = setTimeout(poll, step.intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [step]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Assalamu alaikum. Sign in to start asking.</Text>
      {step.kind === "code" ? (
        <View style={styles.stack}>
          <Text selectable style={styles.code}>
            {step.userCode}
          </Text>
          <Pressable onPress={() => Clipboard.setStringAsync(step.userCode)}>
            <Text style={styles.hint}>Copy code</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => WebBrowser.openBrowserAsync(step.verificationUrl)}
          >
            <Text style={styles.primaryText}>Open ChatGPT</Text>
          </Pressable>
          <Text style={styles.hint}>Waiting for approval</Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {step.kind === "failed" && <Text style={styles.error}>{step.message}</Text>}
          <Pressable
            disabled={step.kind === "waiting"}
            style={[styles.button, styles.primary]}
            onPress={withChatGPT}
          >
            <Text style={styles.primaryText}>Continue with ChatGPT</Text>
          </Pressable>
          <Pressable
            disabled={step.kind === "waiting"}
            style={[styles.button, styles.secondary]}
            onPress={withGoogle}
          >
            <Text style={styles.secondaryText}>Continue with Google</Text>
          </Pressable>
          <Text style={styles.hint}>Use your ChatGPT plan for GPT models</Text>
          {step.kind === "waiting" && <ActivityIndicator color={colors.muted} />}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 28, gap: 24 },
  title: {
    color: colors.foreground,
    fontSize: 19,
    fontWeight: "500",
    textAlign: "center",
  },
  stack: { gap: 10, alignItems: "stretch" },
  button: {
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.foreground },
  primaryText: { color: colors.background, fontSize: 15, fontWeight: "600" },
  secondary: { backgroundColor: colors.subtle },
  secondaryText: { color: colors.foreground, fontSize: 15, fontWeight: "500" },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center" },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
  code: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: 4,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});
