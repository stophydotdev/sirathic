"use client";

import { MODEL_DESCRIPTIONS, useAccount } from "@/components/account";
import { type Translate, useT } from "@/components/i18n";
import { MakerIcon } from "@/components/maker-icon";
import {
  AboutSection,
  AccountSection,
  DataSection,
  ModelsSection,
  PersonalizationSection,
  PreferencesSection,
} from "@/components/settings-sections";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconCpu,
  IconDatabase,
  IconInfoCircle,
  IconSearch,
  IconUserCircle,
  IconWriting,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { Dialog } from "radix-ui";
import { type FC, useState } from "react";
import { create } from "zustand";

const SECTIONS = ["account", "preferences", "personalization", "models", "data", "about"] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_DETAILS = {
  account: {
    name: "Account",
    group: "You",
    icon: IconUserCircle,
    keywords: "sign in sign out chatgpt",
    Body: AccountSection,
  },
  preferences: {
    name: "Preferences",
    group: "You",
    icon: IconAdjustmentsHorizontal,
    keywords: "theme dark light system suggestions mode",
    Body: PreferencesSection,
  },
  personalization: {
    name: "Personalization",
    group: "You",
    icon: IconWriting,
    keywords: "name madhab custom instructions language length arabic",
    Body: PersonalizationSection,
  },
  models: {
    name: "Models",
    group: "Answers",
    icon: IconCpu,
    keywords: "model default gpt luna claude haiku deepseek glm qwen mimo",
    Body: ModelsSection,
  },
  data: {
    name: "Data controls",
    group: "Other",
    icon: IconDatabase,
    keywords: "incognito export download delete chats history",
    Body: DataSection,
  },
  about: {
    name: "About",
    group: "Other",
    icon: IconInfoCircle,
    keywords: "sources credits quran hadith fiqh stophy",
    Body: AboutSection,
  },
} satisfies Record<
  Section,
  {
    name: MessageKey;
    group: MessageKey;
    icon: TablerIcon;
    keywords: string;
    Body: FC;
  }
>;

export const useSettings = create<{
  open: boolean;
  section: Section;
  show: (section?: Section) => void;
  setOpen: (open: boolean) => void;
}>()((set) => ({
  open: false,
  section: "account",
  show: (section) => set((current) => ({ open: true, section: section ?? current.section })),
  setOpen: (open) => set({ open }),
}));

const modelRow = "h-9 gap-2 rounded-[8px] p-2 text-sm font-[360]";

const matches = (section: Section, query: string, t: Translate) => {
  const { name, keywords } = SECTION_DETAILS[section];
  return `${t(name)} ${name} ${keywords}`.toLowerCase().includes(query.toLowerCase());
};

export const SettingsDialog: FC = () => {
  const open = useSettings((s) => s.open);
  const setOpen = useSettings((s) => s.setOpen);
  const section = useSettings((s) => s.section);
  const show = useSettings((s) => s.show);
  const [query, setQuery] = useState("");
  const t = useT();
  const shown = SECTIONS.filter((item) => matches(item, query.trim(), t));
  const groups = [...new Set(shown.map((item) => SECTION_DETAILS[item].group))];
  const { name, Body } = SECTION_DETAILS[section];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-background/70 fixed inset-0 z-50 backdrop-blur-[4px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="bg-popover border-foreground/10 fixed top-1/2 left-1/2 z-50 flex h-[740px] max-h-[calc(100dvh-2rem)] w-[1000px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border outline-none md:flex-row"
        >
          <nav
            aria-label={t("Settings sections")}
            className="border-foreground/8 flex shrink-0 flex-col gap-0.5 border-b p-2.5 md:w-[232px] md:border-e md:border-b-0"
          >
            <label className="border-border text-muted-foreground mb-2 flex h-[38px] items-center gap-2 rounded-[10px] border px-3 md:mb-3.5">
              <IconSearch className="size-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  const first = shown[0];
                  if (event.key === "Enter" && first) show(first);
                }}
                placeholder={t("Search settings")}
                className="placeholder:text-muted-foreground text-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <div className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
              {groups.map((group) => (
                <div key={group} className="flex gap-0.5 md:flex-col">
                  <span className="text-muted-foreground hidden px-2.5 pt-3 pb-1.5 text-xs md:block">
                    {t(group)}
                  </span>
                  {shown
                    .filter((item) => SECTION_DETAILS[item].group === group)
                    .map((item) => {
                      const { name: label, icon: Icon } = SECTION_DETAILS[item];
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-current={item === section ? "page" : undefined}
                          onClick={() => show(item)}
                          className={cn(
                            "hover:bg-muted flex h-[34px] shrink-0 items-center gap-2.5 rounded-[8px] px-2.5 text-start text-sm",
                            item === section && "bg-muted",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          {t(label)}
                        </button>
                      );
                    })}
                </div>
              ))}
              {shown.length === 0 && (
                <p className="text-muted-foreground px-2.5 py-2 text-sm">
                  {t("No settings found")}
                </p>
              )}
            </div>
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-3 md:px-[30px]">
              <Dialog.Title className="text-[19px] font-[470]">{t(name)}</Dialog.Title>
              <Dialog.Close
                aria-label={t("Close")}
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-full border transition-colors"
              >
                <IconX className="size-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-8 md:px-[30px]">
              <Body />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const ModelMenuContent: FC<{
  onManage?: () => void;
  side?: "top" | "bottom";
}> = ({ onManage, side }) => {
  const status = useAccount((s) => s.status);
  const models = useAccount((s) => s.models);
  const chosen = useAccount((s) => s.chosen);
  const choose = useAccount((s) => s.choose);
  const t = useT();

  return (
    <DropdownMenuContent
      align="end"
      side={side}
      avoidCollisions={side === undefined}
      className="ring-foreground/7 max-h-[min(405px,var(--radix-dropdown-menu-content-available-height))] w-70 rounded-[12px] p-1"
    >
      {status?.signedIn && status.via === "chatgpt" && (
        <DropdownMenuLabel className="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-normal">
          {t("From your ChatGPT account")}
        </DropdownMenuLabel>
      )}
      {models.length === 0 && (
        <DropdownMenuItem disabled className={modelRow}>
          {t("No chat models available")}
        </DropdownMenuItem>
      )}
      {models.map((model) => {
        const description = MODEL_DESCRIPTIONS.get(model.slug);
        return (
          <DropdownMenuItem
            key={model.slug}
            onSelect={() => choose(model.slug)}
            className={cn(modelRow, description && "h-auto items-start")}
          >
            <MakerIcon maker={model.maker} className={cn("size-4", description && "mt-0.5")} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{model.name}</span>
              {description && (
                <span className="text-muted-foreground text-xs">{t(description)}</span>
              )}
            </span>
            {chosen === model.slug && <IconCheck className="size-4" />}
          </DropdownMenuItem>
        );
      })}
      {onManage && (
        <DropdownMenuItem onSelect={onManage} className={modelRow}>
          <IconAdjustmentsHorizontal className="size-4" />
          {t("Manage models")}
        </DropdownMenuItem>
      )}
    </DropdownMenuContent>
  );
};
