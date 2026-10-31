"use client";

import { useT } from "@/components/i18n";
import { PlacesCard } from "@/components/placesCard";
import { QuizCard } from "@/components/quizCard";
import { useSettings } from "@/components/settings";
import { StepsCard } from "@/components/stepsCard";
import { TranslationCard } from "@/components/translationCard";
import { messageMetadata } from "@sirathic/server/messages";
import { useAuiState } from "@assistant-ui/react";
import { BrainIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FC } from "react";

export const AnswerCard: FC<{ name: string; args: unknown; result: unknown }> = ({
  name,
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
