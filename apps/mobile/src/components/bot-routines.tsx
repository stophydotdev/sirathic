import { type FC, type ReactNode, useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "@/lib/api";
import { type Automation, describeSchedule, formatInstant } from "@/lib/automations";
import { dialogButton } from "./confirm";
import { ChevronLeft, ChevronRight, Clock, PlayerPause, PlayerPlay } from "./icons";

export const useRoutines = (botId: string) => {
  const [routines, setRoutines] = useState<Automation[]>();

  const refresh = useCallback(async () => {
    const found = await api.automations.list.query().catch(() => undefined);
    if (found) setRoutines(found.filter((routine) => routine.projectId === botId));
  }, [botId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { routines, refresh };
};

export const card = "bg-card gap-1 rounded-xl p-4";

export const RoutineList: FC<{
  routines: Automation[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}> = ({ routines, onOpen, onCreate }) => (
  <View className={card}>
    <Text className="text-foreground font-medium mb-1 text-sm">Routines</Text>
    {routines.length === 0 && (
      <Text className="text-muted-foreground font-sans py-3 text-center text-sm">
        Routines are recurring tasks this bot runs on a schedule.
      </Text>
    )}
    {routines.map((routine) => (
      <Pressable
        key={routine.id}
        onPress={() => onOpen(routine.id)}
        className="active:bg-muted -mx-2 flex-row items-center gap-3 rounded-[10px] px-2 py-2"
      >
        <Clock size={22} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        <View className="flex-1">
          <Text numberOfLines={1} className="text-foreground font-medium text-sm">
            {routine.name}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Text numberOfLines={1} className="text-muted-foreground font-sans flex-1 text-xs">
              {describeSchedule(routine.schedule)}
            </Text>
            {!routine.enabled && (
              <>
                <PlayerPause
                  size={18}
                  strokeWidth={1.75}
                  colorClassName="accent-muted-foreground"
                />
                <Text className="text-muted-foreground font-sans text-xs">Paused</Text>
              </>
            )}
          </View>
        </View>
        <ChevronRight size={20} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
      </Pressable>
    ))}
    <Pressable
      onPress={onCreate}
      className="border-border active:bg-foreground/5 mt-2 self-center rounded-xl border px-4 py-2"
    >
      <Text className="text-foreground font-sans text-sm">Create routine</Text>
    </Pressable>
  </View>
);

const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <View className="border-foreground/10 flex-row items-start justify-between gap-4 border-b py-2.5">
    <Text className="text-muted-foreground font-sans text-sm">{label}</Text>
    <View className="flex-1 flex-row items-center justify-end gap-1.5">{children}</View>
  </View>
);

const Value: FC<{ children: string }> = ({ children }) => (
  <Text className="text-foreground font-sans text-end text-sm">{children}</Text>
);

export const RoutineDetail: FC<{
  routine: Automation;
  onBack: () => void;
  onChanged: () => Promise<void>;
}> = ({ routine, onBack, onChanged }) => {
  const [confirming, setConfirming] = useState(false);

  const toggle = async () => {
    await api.automations.update
      .mutate({ id: routine.id, enabled: !routine.enabled })
      .catch(() => undefined);
    await onChanged();
  };

  const remove = async () => {
    await api.automations.remove.mutate({ id: routine.id }).catch(() => undefined);
    await onChanged();
    onBack();
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityLabel="Back"
          onPress={onBack}
          className="active:bg-muted size-8 items-center justify-center rounded-full"
        >
          <ChevronLeft size={22} strokeWidth={1.75} colorClassName="accent-muted-foreground" />
        </Pressable>
        <Text numberOfLines={1} className="text-foreground font-semibold flex-1 text-sm">
          {routine.name}
        </Text>
      </View>
      <View>
        <Row label="Schedule">
          <Value>{describeSchedule(routine.schedule)}</Value>
        </Row>
        <Row label="Status">
          {!routine.enabled && (
            <PlayerPause size={18} strokeWidth={1.75} colorClassName="accent-foreground" />
          )}
          <Value>{routine.enabled ? "Active" : "Paused"}</Value>
        </Row>
        <Row label="Next run">
          <Value>
            {routine.enabled && routine.nextRunAt ? formatInstant(routine.nextRunAt) : "None"}
          </Value>
        </Row>
      </View>
      <View className="gap-1.5">
        <Text className="text-muted-foreground font-sans text-sm">Instructions</Text>
        <ScrollView
          className="bg-foreground/3 max-h-48 rounded-[10px] px-3 py-2"
          nestedScrollEnabled
        >
          <Text className="text-foreground font-sans text-sm">{routine.prompt}</Text>
        </ScrollView>
      </View>
      <Row label="Last run">
        <Value>{routine.lastRunAt ? formatInstant(routine.lastRunAt) : "Never"}</Value>
      </Row>
      {confirming ? (
        <View className="gap-3">
          <Text className="text-muted-foreground font-sans text-sm">
            {`Delete the routine "${routine.name}"?`}
          </Text>
          <View className="flex-row justify-end gap-2">
            <Pressable
              onPress={() => setConfirming(false)}
              className={`${dialogButton} border-border border`}
            >
              <Text className="text-foreground font-medium text-sm">Cancel</Text>
            </Pressable>
            <Pressable onPress={() => void remove()} className={`${dialogButton} bg-destructive`}>
              <Text className="font-medium text-sm text-white">Delete</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between gap-2">
          <Pressable
            onPress={() => setConfirming(true)}
            className={`${dialogButton} border-destructive/40 border`}
          >
            <Text className="text-destructive font-medium text-sm">Delete</Text>
          </Pressable>
          <Pressable
            onPress={() => void toggle()}
            className={`${dialogButton} border-border flex-row gap-1.5 border`}
          >
            {routine.enabled ? (
              <PlayerPause size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
            ) : (
              <PlayerPlay size={20} strokeWidth={1.75} colorClassName="accent-foreground" />
            )}
            <Text className="text-foreground font-medium text-sm">
              {routine.enabled ? "Pause" : "Resume"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};
