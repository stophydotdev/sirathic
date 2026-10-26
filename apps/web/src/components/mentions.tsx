"use client";

import { useAccount } from "@/components/account";
import { useT } from "@/components/i18n";
import { LinkedText, splitLinks } from "@/components/linkedText";
import { MentionIcon } from "@/components/mentionIcon";
import { type MentionTarget, splitMentions } from "@/components/mentionText";
import { popoverHeading, popoverIcon, popoverPanel, popoverRow } from "@/components/popover";
import { faviconUrl } from "@/components/sources";
import { api } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ComposerPrimitive,
  type DirectiveFormatter,
  type DirectiveSegment,
  type TriggerAdapter,
  type TriggerItem,
} from "@assistant-ui/react";
import {
  $isDirectiveNode,
  type DirectiveChipProps,
  DirectiveNode,
} from "@assistant-ui/react-lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { connectorId, CONNECTORS } from "@sirathic/server/catalog";
import { IconPlug, IconSparkles } from "@tabler/icons-react";
import { mergeRegister } from "@lexical/utils";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  KEY_BACKSPACE_COMMAND,
  TextNode,
} from "lexical";
import Link from "next/link";
import { type FC, Fragment, type ReactNode, useEffect, useMemo } from "react";
import { create } from "zustand";

export type Choice = {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  choose: () => void;
  fill?: () => void;
};

type Plugin = Awaited<ReturnType<typeof api.connectors.list.query>>[number];
type Skill = Awaited<ReturnType<typeof api.skills.list.query>>[number];

let loading: Promise<void> | undefined;

const useMentionTargets = create<{
  plugins: Plugin[];
  skills: Skill[];
  loaded: boolean;
  load: () => Promise<void>;
}>()((set) => ({
  plugins: [],
  skills: [],
  loaded: false,
  load: () =>
    (loading ??= Promise.all([api.connectors.list.query(), api.skills.list.query()])
      .catch(() => [[], []])
      .then(([plugins, skills]) => set({ plugins, skills, loaded: true }))
      .finally(() => {
        loading = undefined;
      })),
}));

export const loadMentionTargets = () => useMentionTargets.getState().load();

export const usePlugins = () => useMentionTargets((s) => s.plugins);

export function usePluginTargets() {
  const plugins = useMentionTargets((s) => s.plugins);
  return (id: string): MentionTarget => {
    const found = plugins.find((plugin) => plugin.id === id);
    if (found) return { name: found.name, url: found.url };
    const known = connectorId.safeParse(id);
    return known.success ? CONNECTORS[known.data] : { name: id };
  };
}

const itemsOf = (plugins: Plugin[], skills: Skill[]): TriggerItem[] => [
  ...plugins
    .filter((plugin) => plugin.connected)
    .map((plugin) => ({ id: plugin.id, type: "plugin", label: plugin.name })),
  ...skills.map((skill) => ({ id: skill.id, type: "skill", label: skill.name })),
];

const iconTarget = (plugins: Plugin[], id: string, name: string) => {
  const url = plugins.find((plugin) => plugin.id === id)?.url;
  return url ? { name, url } : { name };
};

export const mentionFormatter: DirectiveFormatter = {
  serialize: (item) => `@${item.label}`,
  parse: (text) => {
    const { plugins, skills } = useMentionTargets.getState();
    const named = itemsOf(plugins, skills).map((item) => ({ name: item.label, item }));
    return splitMentions(text, named).map((part): DirectiveSegment =>
      part.kind === "text"
        ? { kind: "text", text: part.value }
        : {
            kind: "mention",
            type: part.target.item.type,
            label: part.target.item.label,
            id: part.target.item.id,
          },
    );
  },
};

export const MentionChip: FC<DirectiveChipProps> = ({ directiveId, label }) => {
  const plugins = useMentionTargets((s) => s.plugins);
  return (
    <span className="text-super">
      <MentionIcon target={iconTarget(plugins, directiveId, label)} className="me-1 align-[-3px]" />
      {label}
    </span>
  );
};

const linkStyle = (part: ReturnType<typeof splitLinks>[number]) =>
  part.kind === "link" ? `--link-icon: url("${faviconUrl(part.value)}")` : "";

const textRun = (node: TextNode) => {
  const run = [node];
  for (let at = node.getPreviousSibling(); $isTextNode(at); at = at.getPreviousSibling()) {
    run.unshift(at);
  }
  for (let at = node.getNextSibling(); $isTextNode(at); at = at.getNextSibling()) run.push(at);
  return run;
};

export const LinkPlugin: FC = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      editor.registerNodeTransform(TextNode, (node) => {
        const run = textRun(node);
        const parts = splitLinks(run.map((piece) => piece.getTextContent()).join("")).map(
          (part) => ({ value: part.value, style: linkStyle(part) }),
        );
        const settled =
          run.length === parts.length &&
          run.every(
            (piece, index) =>
              piece.getTextContent() === parts[index]?.value &&
              piece.getStyle() === parts[index]?.style,
          );
        if (settled) return;
        const [first = node, ...rest] = run;
        const merged = rest.reduce((all, piece) => all.mergeWithSibling(piece), first);
        const cuts: number[] = [];
        let end = 0;
        for (const part of parts.slice(0, -1)) {
          end += part.value.length;
          cuts.push(end);
        }
        const pieces = cuts.length > 0 ? merged.splitText(...cuts) : [merged];
        pieces.forEach((piece, index) => piece.setStyle(parts[index]?.style ?? ""));
      }),
    [editor],
  );
  return null;
};

export const MentionSpace: FC = () => {
  const [editor] = useLexicalComposerContext();
  useEffect(
    () =>
      mergeRegister(
        editor.registerCommand(
          KEY_BACKSPACE_COMMAND,
          (event) => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
            const node = selection.anchor.getNode();
            const before = node.getPreviousSibling();
            if (
              !$isTextNode(node) ||
              selection.anchor.offset !== 1 ||
              !node.getTextContent().startsWith(" ") ||
              !$isDirectiveNode(before)
            )
              return false;
            event.preventDefault();
            before.remove();
            node.spliceText(0, 1, "", true);
            return true;
          },
          COMMAND_PRIORITY_NORMAL,
        ),
        editor.registerMutationListener(
          DirectiveNode,
          (mutations) => {
            for (const [key, mutation] of mutations) {
              if (mutation !== "created") continue;
              editor.update(() => {
                const node = $getNodeByKey(key);
                const selection = $getSelection();
                if (!node || !$isRangeSelection(selection) || !selection.isCollapsed()) return;
                const next = node.getNextSibling();
                const { anchor } = selection;
                const caretAfter = next
                  ? anchor.key === next.getKey() && anchor.offset === 0
                  : anchor.key === node.getParentOrThrow().getKey() &&
                    anchor.offset === node.getIndexWithinParent() + 1;
                if (!caretAfter) return;
                if ($isTextNode(next) && /^\s/u.test(next.getTextContent())) next.select(1, 1);
                else selection.insertText(" ");
              });
            }
          },
          { skipInitialization: true },
        ),
      ),
    [editor],
  );
  return null;
};

export const MentionPopover: FC<{ className: string }> = ({ className }) => {
  const t = useT();
  const { plugins, skills, loaded, load } = useMentionTargets();
  const all = useMemo(() => itemsOf(plugins, skills), [plugins, skills]);
  useEffect(() => {
    void load();
  }, [load]);
  const adapter = useMemo<TriggerAdapter>(
    () => ({
      categories: () => [],
      categoryItems: () => [],
      search: (query) =>
        all.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    }),
    [all],
  );

  return (
    <ComposerPrimitive.TriggerPopover char="@" adapter={adapter} className={className}>
      <ComposerPrimitive.TriggerPopover.Directive formatter={mentionFormatter} />
      <ComposerPrimitive.TriggerPopoverItems>
        {(items) =>
          items.length > 0 ? (
            <div className={cn(popoverPanel, "w-60")}>
              {items.map((item, index) => (
                <Fragment key={item.id}>
                  {item.type !== items[index - 1]?.type && (
                    <p className={cn(popoverHeading, index > 0 && "mt-1")}>
                      {item.type === "plugin" ? t("Plugins") : t("Skills")}
                    </p>
                  )}
                  <ComposerPrimitive.TriggerPopoverItem
                    item={item}
                    index={index}
                    className={cn(popoverRow, "data-highlighted:bg-foreground/8")}
                  >
                    <span className={popoverIcon}>
                      <MentionIcon target={iconTarget(plugins, item.id, item.label)} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </ComposerPrimitive.TriggerPopoverItem>
                </Fragment>
              ))}
            </div>
          ) : loaded && all.length === 0 ? (
            <div className={cn(popoverPanel, "w-60")}>
              <Link href="/plugins" className={cn(popoverRow, "hover:bg-foreground/8")}>
                <span className={popoverIcon}>
                  <IconPlug className="size-4" />
                </span>
                {t("Add a plugin")}
              </Link>
              <Link href="/plugins?tab=skills" className={cn(popoverRow, "hover:bg-foreground/8")}>
                <span className={popoverIcon}>
                  <IconSparkles className="size-4" />
                </span>
                {t("Write a skill")}
              </Link>
            </div>
          ) : null
        }
      </ComposerPrimitive.TriggerPopoverItems>
    </ComposerPrimitive.TriggerPopover>
  );
};

export const UserText: FC<{ text: string }> = ({ text }) => {
  const signedIn = useAccount((s) => s.status?.signedIn === true);
  const { plugins, skills, loaded, load } = useMentionTargets();
  useEffect(() => {
    if (signedIn && !loaded) void load();
  }, [signedIn, loaded, load]);
  return (
    <p>
      <LinkedText text={text} targets={[...plugins, ...skills]} />
    </p>
  );
};
