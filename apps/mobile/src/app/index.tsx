import { ActivityIndicator, View } from "react-native";
import { Chat } from "@/components/chat";
import { SignIn } from "@/components/sign-in";
import { authClient } from "@/lib/auth";
import { useChatState } from "@/lib/chat-state";
import { colors } from "@/theme";

export default function Home() {
  const { data, isPending } = authClient.useSession();
  const chatId = useChatState((s) => s.chatId);

  if (isPending) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }
  return data ? <Chat key={chatId} id={chatId} /> : <SignIn />;
}
