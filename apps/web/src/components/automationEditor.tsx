"use client";

import { askNotifications } from "@/components/automationAlerts";
import { type Automation, localZone } from "@/components/automationText";
import { type Draft, isComplete, scheduleOf } from "@sirathic/app/automationDraft";
import { TriggerField } from "@/components/automationTrigger";
import { useT } from "@/components/i18n";
import {
  LinkPlugin,
  MentionChip,
  mentionFormatter,
  MentionPopover,
  MentionSpace,
} from "@/components/mentions";
import { useOwnLists } from "@/components/ownLists";
import { IconPicker, ProjectIcon } from "@/components/projectIcon";
import { Modal, modalButton, modalPrimaryButton } from "@/components/sessionMenu";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  ComposerPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
} from "@assistant-ui/react";
import { LexicalComposerInput } from "@assistant-ui/react-lexical";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, TimeScheduleIcon } from "@hugeicons/core-free-icons";
import { Dialog } from "radix-ui";
import { type FC, useEffect, useState } from "react";

const field =
  "border-border placeholder:text-muted-foreground focus:border-foreground/30 rounded-[10px] border bg-transparent px-3 text-sm outline-none";

const noReply: ChatModelAdapter = { run: async () => ({ content: [] }) };

const InstructionsBox: FC = () => {
  const t = useT();
  return (
    <ComposerPrimitive.TriggerPopoverRoot>
      <div className="relative">
        <div className="bg-fill flex flex-col rounded-[14px]">
          <LexicalComposerInput
            data-composer
            submitMode="none"
            placeholder={t("What should Noor answer each time?")}
            formatter={mentionFormatter}
            directiveChip={MentionChip}
            className="relative max-h-48 min-h-[72px] w-full px-5 py-4 text-sm leading-5"
          >
            <LinkPlugin />
            <MentionSpace />
          </LexicalComposerInput>
        </div>
        <MentionPopover className="absolute start-3 bottom-full z-30 mb-2" />
      </div>
    </ComposerPrimitive.TriggerPopoverRoot>
  );
};

type EditorProps = {
  automation: Automation | undefined;
  draft: Draft;
  botId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export const AutomationEditor: FC<EditorProps> = (props) => {
  const runtime = useLocalRuntime(noReply);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <EditorDialog {...props} />
    </AssistantRuntimeProvider>
  );
};

const EditorDialog: FC<EditorProps> = ({ automation, draft: initial, botId, onClose, onSaved }) => {
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const [seeded, setSeeded] = useState(false);
  const [fields, setFields] = useState(initial);
  const [deleting, setDeleting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const t = useT();
  const zone = localZone();
  const draft = { ...fields, prompt: seeded ? text : initial.prompt };
  const change = (update: Partial<Draft>) => setFields((current) => ({ ...current, ...update }));

  useEffect(() => {
    let current = true;
    const composer = aui.thread().composer();
    composer.setText(initial.prompt);
    setSeeded(true);
    void useOwnLists
      .getState()
      .load()
      .then(() => {
        if (current && composer.getState().text === initial.prompt) {
          composer.setText("");
          composer.setText(initial.prompt);
        }
      });
    return () => {
      current = false;
    };
  }, [aui, initial.prompt]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const plan = scheduleOf(draft);

  async function run<Result>(work: () => Promise<Result>) {
    setBusy(true);
    setError(undefined);
    try {
      await work();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const save = () => {
    if (!plan || busy || !isComplete(draft)) return;
    const input = {
      name: draft.name,
      prompt: draft.prompt,
      icon: draft.icon,
      schedule: plan,
      timezone: zone,
    };
    if (automation?.notify !== "none") askNotifications();
    void run(() =>
      automation
        ? api.automations.update.mutate({ id: automation.id, ...input })
        : api.automations.create.mutate({ ...input, projectId: botId }),
    );
  };

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => {
          if (open) return;
          if (dirty) setDiscarding(true);
          else onClose();
        }}
        title={automation ? t("Edit automation") : t("New automation")}
        className="bg-surface max-w-[520px]"
      >
        <Dialog.Close
          aria-label={t("Close")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute end-3 top-3 flex size-8 items-center justify-center rounded-full"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Dialog.Close>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t("Pick new icon")}
            title={t("Pick new icon")}
            onClick={() => setPicking(true)}
            className="bg-fill hover:bg-foreground/10 grid size-9 shrink-0 place-items-center rounded-[10px] transition-colors"
          >
            <ProjectIcon icon={draft.icon} blank={TimeScheduleIcon} className="size-5" />
          </button>
          <input
            value={draft.name}
            onChange={(event) => change({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
            }}
            placeholder={t("Morning reminder")}
            aria-label={t("Name")}
            maxLength={60}
            autoFocus
            className={cn(field, "bg-fill h-9 min-w-0 flex-1 border-transparent")}
          />
        </div>
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium">{t("Trigger")}</h3>
          <TriggerField draft={draft} change={change} />
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium">{t("Instructions")}</h3>
          <InstructionsBox />
        </section>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {deleting ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-muted-foreground me-auto text-sm">
              {t("Delete this automation?")}
            </span>
            <button type="button" onClick={() => setDeleting(false)} className={modalButton}>
              {t("Cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                automation && void run(() => api.automations.remove.mutate({ id: automation.id }))
              }
              className={cn(modalPrimaryButton, "bg-destructive text-white")}
            >
              {t("Delete")}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {automation && (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className={cn(modalButton, "bg-fill text-destructive me-auto border-transparent")}
              >
                {t("Delete")}
              </button>
            )}
            <Dialog.Close type="button" className={cn(modalButton, "bg-fill border-transparent")}>
              {t("Cancel")}
            </Dialog.Close>
            <button
              type="button"
              onClick={save}
              disabled={busy || !isComplete(draft) || (automation !== undefined && !dirty)}
              className={modalPrimaryButton}
            >
              {t("Save")}
            </button>
          </div>
        )}
      </Modal>
      {picking && (
        <IconPicker
          icon={draft.icon}
          blank={TimeScheduleIcon}
          blankLabel={t("Default")}
          onPick={(icon) => change({ icon })}
          onClose={() => setPicking(false)}
        />
      )}
      {discarding && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setDiscarding(false);
          }}
          title={t("Discard unsaved changes?")}
        >
          <div className="flex justify-end gap-2">
            <Dialog.Close type="button" className={modalButton}>
              {t("Keep editing")}
            </Dialog.Close>
            <button type="button" onClick={onClose} className={modalPrimaryButton}>
              {t("Discard")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};
