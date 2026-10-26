"use client";

import { MODEL_DESCRIPTIONS, useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { MakerIcon } from "@/components/makerIcon";
import {
  AboutSection,
  AccountSection,
  DataSection,
  PersonalizationSection,
  PreferencesSection,
} from "@/components/settingsSections";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdownMenu";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/messages/en";
import {
  IconAdjustmentsHorizontal,
  IconCheck,
  IconDatabase,
  IconInfoCircle,
  IconSparkles,
  IconUserCircle,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { Dialog } from "radix-ui";
import { type FC } from "react";
import { create } from "zustand";

const SECTIONS = ["account", "preferences", "personalization", "data", "about"] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_DETAILS = {
  account: {
    name: "Account",
    group: "You",
    icon: IconUserCircle,
    Body: AccountSection,
  },
  preferences: {
    name: "Preferences",
    group: "You",
    icon: IconAdjustmentsHorizontal,
    Body: PreferencesSection,
  },
  personalization: {
    name: "Customize",
    group: "You",
    icon: IconSparkles,
    Body: PersonalizationSection,
  },
  data: {
    name: "Data controls",
    group: "Other",
    icon: IconDatabase,
    Body: DataSection,
  },
  about: {
    name: "About",
    group: "Other",
    icon: IconInfoCircle,
    Body: AboutSection,
  },
} satisfies Record<
  Section,
  {
    name: MessageKey;
    group: MessageKey;
    icon: TablerIcon;
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

const GROUPS = [...new Set(SECTIONS.map((item) => SECTION_DETAILS[item].group))];

export const SettingsDialog: FC = () => {
  const open = useSettings((s) => s.open);
  const setOpen = useSettings((s) => s.setOpen);
  const section = useSettings((s) => s.section);
  const show = useSettings((s) => s.show);
  const t = useT();
  const { name, Body } = SECTION_DETAILS[section];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-background/70 fixed inset-0 z-50 backdrop-blur-[4px]" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="bg-popover border-foreground/6 fixed top-1/2 left-1/2 z-50 flex h-[624px] max-h-[calc(100dvh-2rem)] w-[1000px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[16px] border outline-none md:flex-row"
        >
          <nav
            aria-label={t("Settings sections")}
            className="border-foreground/6 flex shrink-0 flex-col gap-0.5 border-b p-2.5 md:w-[200px] md:border-e md:border-b-0"
          >
            <div className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
              {GROUPS.map((group) => (
                <div key={group} className="flex gap-0.5 md:flex-col">
                  <span className="text-muted-foreground/70 hidden px-2.5 pt-3 pb-1 text-[13px] md:block">
                    {t(group)}
                  </span>
                  {SECTIONS.filter((item) => SECTION_DETAILS[item].group === group).map((item) => {
                    const { name: label, icon: Icon } = SECTION_DETAILS[item];
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-current={item === section ? "page" : undefined}
                        onClick={() => show(item)}
                        className={cn(
                          "hover:bg-muted flex h-8 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 text-start text-sm",
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
            </div>
          </nav>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between ps-5 pe-3 pt-4 pb-2">
              <Dialog.Title className="text-[15px] font-semibold">{t(name)}</Dialog.Title>
              <Dialog.Close
                aria-label={t("Close")}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-[12px] transition-colors"
              >
                <IconX className="size-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              <Body />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const ModelMenuContent: FC<{
  side?: "top" | "bottom";
}> = ({ side }) => {
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
    </DropdownMenuContent>
  );
};
