import type { FC, ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";

export const Group: FC<{ title?: string; children: ReactNode }> = ({ title, children }) => (
  <View className="border-foreground/6 border-t py-3 first:border-t-0">
    {title && <Text className="text-muted-foreground font-sans pt-1 text-xs">{title}</Text>}
    {children}
  </View>
);

export const Setting: FC<{
  label: string;
  hint?: string;
  children?: ReactNode;
  stacked?: boolean;
}> = ({ label, hint, children, stacked = false }) => (
  <View
    className={`min-h-[52px] gap-x-4 gap-y-2 py-3 ${stacked ? "" : "flex-row flex-wrap items-center"}`}
  >
    <View className="min-w-0 flex-1 gap-0.5">
      <Text className="text-foreground font-sans text-sm">{label}</Text>
      {hint && <Text className="text-muted-foreground font-sans text-xs">{hint}</Text>}
    </View>
    {children}
  </View>
);

export function Segmented<Value extends string>({
  value,
  options,
  onChange,
}: {
  value: Value;
  options: readonly (readonly [Value, string])[];
  onChange: (next: Value) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1.5">
      {options.map(([option, label]) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityState={{ checked: option === value }}
          onPress={() => onChange(option)}
          className={`h-8 items-center justify-center rounded-full border px-3 ${option === value ? "border-foreground/40 bg-foreground/12" : "border-foreground/10"}`}
        >
          <Text
            className={`font-sans text-sm ${option === value ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Toggle: FC<{ value: boolean; onChange: (on: boolean) => void }> = ({
  value,
  onChange,
}) => (
  <Switch
    value={value}
    onValueChange={onChange}
    trackColorOnClassName="accent-super"
    trackColorOffClassName="accent-foreground/15"
    thumbColorClassName="accent-white"
  />
);

export const ActionButton: FC<{ label: string; danger?: boolean; onPress: () => void }> = ({
  label,
  danger = false,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    className="border-foreground/10 active:bg-muted h-8 items-center justify-center rounded-[12px] border px-2.5"
  >
    <Text className={`font-medium text-sm ${danger ? "text-destructive" : "text-foreground"}`}>
      {label}
    </Text>
  </Pressable>
);
