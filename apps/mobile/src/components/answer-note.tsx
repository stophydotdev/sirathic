import type { FC, ReactNode } from "react";
import { Text, View } from "react-native";
import type { NoteKind } from "@/lib/notes";
import { AlertCircle, AlertOctagon, AlertTriangle, Bulb, Info } from "./icons";

const NOTES = {
  note: {
    label: "Note",
    icon: Info,
    tone: "border-super",
    text: "text-super",
    accent: "accent-super",
  },
  tip: {
    label: "Tip",
    icon: Bulb,
    tone: "border-emerald-500/70",
    text: "text-emerald-600 dark:text-emerald-400",
    accent: "accent-emerald-600 dark:accent-emerald-400",
  },
  important: {
    label: "Important",
    icon: AlertCircle,
    tone: "border-violet-500/70",
    text: "text-violet-600 dark:text-violet-400",
    accent: "accent-violet-600 dark:accent-violet-400",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    tone: "border-amber-500/70",
    text: "text-amber-600 dark:text-amber-500",
    accent: "accent-amber-600 dark:accent-amber-500",
  },
  caution: {
    label: "Caution",
    icon: AlertOctagon,
    tone: "border-red-500/70",
    text: "text-red-600 dark:text-red-400",
    accent: "accent-red-600 dark:accent-red-400",
  },
} as const;

export const AnswerNote: FC<{ kind: NoteKind; children: ReactNode }> = ({ kind, children }) => {
  const { label, icon: Icon, tone, text, accent } = NOTES[kind];
  return (
    <View className={`mb-4 gap-1 border-s-2 ps-3 ${tone}`}>
      <View className="flex-row items-center gap-1.5">
        <Icon size={16} strokeWidth={2} colorClassName={accent} />
        <Text className={`font-sans text-sm font-medium ${text}`}>{label}</Text>
      </View>
      {children}
    </View>
  );
};
