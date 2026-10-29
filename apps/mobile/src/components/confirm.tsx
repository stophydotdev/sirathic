import { type FC, useState } from "react";
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from "react-native";
import { create } from "zustand";
import { Dim, Pop } from "./motion";

type Request = {
  title: string;
  body?: string;
  action: string;
  danger?: boolean;
  field?: { maxLength: number };
  onConfirm: (text: string) => void;
};

export const useConfirm = create<{
  request: Request | undefined;
  ask: (request: Request) => void;
  close: () => void;
}>()((set) => ({
  request: undefined,
  ask: (request) => set({ request }),
  close: () => set({ request: undefined }),
}));

export const dialogButton = "h-8 items-center justify-center rounded-md px-3";

const Dialog: FC<{ request: Request; close: () => void }> = ({ request, close }) => {
  const [text, setText] = useState("");
  const ready = !request.field || text.trim() !== "";
  return (
    <Pressable className="bg-background border-foreground/7 w-full max-w-md gap-4 rounded-[20px] border p-5 shadow-lg">
      <Text className="text-foreground font-medium text-base">{request.title}</Text>
      {request.body && (
        <Text className="text-muted-foreground font-sans text-sm">{request.body}</Text>
      )}
      {request.field && (
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          maxLength={request.field.maxLength}
          className="border-border text-foreground font-sans h-10 rounded-xl border px-3 text-sm"
        />
      )}
      <View className="flex-row justify-end gap-2">
        <Pressable
          onPress={close}
          className={`${dialogButton} border-border active:bg-muted border`}
        >
          <Text className="text-foreground font-medium text-sm">Cancel</Text>
        </Pressable>
        <Pressable
          disabled={!ready}
          onPress={() => {
            close();
            request.onConfirm(text.trim());
          }}
          className={`${dialogButton} active:opacity-85 ${request.danger ? "bg-destructive" : "bg-primary"} ${ready ? "" : "opacity-60"}`}
        >
          <Text
            className={`font-medium text-sm ${request.danger ? "text-white" : "text-primary-foreground"}`}
          >
            {request.action}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

export const ConfirmDialog: FC = () => {
  const request = useConfirm((s) => s.request);
  const close = useConfirm((s) => s.close);

  return (
    <Modal visible={request !== undefined} transparent animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <Pressable onPress={close} className="flex-1 items-center justify-center px-4">
          <Dim />
          {request && (
            <Pop className="w-full max-w-md">
              <Dialog request={request} close={close} />
            </Pop>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
