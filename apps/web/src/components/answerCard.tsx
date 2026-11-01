"use client";

import { useT } from "@/components/i18n";
import { IslamicDatesCard } from "@/components/islamicDatesCard";
import { PlacesCard } from "@/components/placesCard";
import { PrayerTimesCard } from "@/components/prayerTimesCard";
import { ProductsCard } from "@/components/productsCard";
import { MADHAB_NAMES } from "@/components/settingsCustomize";
import { QuizCard } from "@/components/quizCard";
import { useSettings } from "@/components/settings";
import { StepsCard } from "@/components/stepsCard";
import { TodoCard } from "@/components/todoCard";
import { TranslationCard } from "@/components/translationCard";
import { settingChange } from "@sirathic/server/cards";
import { messageMetadata } from "@sirathic/server/messages";
import { useAuiState } from "@assistant-ui/react";
import { BrainIcon, UserEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FC } from "react";

export const AnswerCard: FC<{ name: string; callId: string; args: unknown; result: unknown }> = ({
  name,
  callId,
  args,
  result,
}) => {
  switch (name) {
    case "show_steps":
      return <StepsCard args={args} />;
    case "show_quiz":
      return <QuizCard args={args} />;
    case "show_translation":
      return <TranslationCard args={args} />;
    case "show_places":
      return <PlacesCard result={result} />;
    case "show_products":
      return <ProductsCard result={result} />;
    case "prayer_times":
      return <PrayerTimesCard result={result} />;
    case "islamic_dates":
      return <IslamicDatesCard result={result} />;
    case "change_setting":
      return <SettingChanged result={result} />;
    case "todo_write":
      return <TodoCard callId={callId} result={result} />;
    default:
      return null;
  }
};

export const MemoryUsed: FC = () => {
  const used = useAuiState(
    (s) => messageMetadata.safeParse(s.message.metadata.custom).data?.memory === true,
  );
  const t = useT();
  if (!used) return null;
  return (
    <button
      type="button"
      onClick={() => useSettings.getState().show("data")}
      className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1.5 text-sm print:hidden"
    >
      <HugeiconsIcon icon={BrainIcon} className="size-4" />
      {t("Used your memory")}
    </button>
  );
};

const SettingChanged: FC<{ result: unknown }> = ({ result }) => {
  const change = settingChange.safeParse(result).data;
  const t = useT();
  if (!change) return null;
  const said = [
    change.madhab && t("Madhab set to {school}", { school: t(MADHAB_NAMES[change.madhab]) }),
    change.name !== undefined && t("Name set to {name}", { name: change.name }),
    change.about !== undefined && t("Updated what you told me about yourself"),
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => useSettings.getState().show("customize")}
      className="text-muted-foreground hover:text-foreground my-3 inline-flex items-center gap-1.5 text-start text-sm print:hidden"
    >
      <HugeiconsIcon icon={UserEdit01Icon} className="size-4 shrink-0" />
      {said.join(" · ")}
    </button>
  );
};
