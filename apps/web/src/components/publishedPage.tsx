"use client";

import { answerText } from "@/components/agents/streamingResponse";
import { rehypeCitations } from "@/components/citations";
import { Note, rehypeNotes } from "@/components/markdownNote";
import { remarkPlugins, withMathDelimiters } from "@/components/markdownText";
import { unwrappedCitations } from "@sirathic/app/citations";
import { Favicon } from "@/components/favicon";
import { useT } from "@/components/i18n";
import { siteName } from "@/components/sources";
import type { Source } from "@sirathic/server/sources";
import type { Element } from "hast";
import type { ComponentProps, FC } from "react";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import { z } from "zod";

const citedUrls = z.array(z.string()).min(1);
const CITED_URL = /\]\((https?:\/\/[^)\s]+)\)/gu;

const Anchor: FC<ComponentProps<"a"> & { node?: Element }> = ({ node, children, ...props }) => {
  const urls = citedUrls.safeParse(node?.properties.dataUrls).data;
  if (!urls) {
    return (
      <a target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  }
  const [first, ...more] = urls;
  return (
    <a
      href={first}
      target="_blank"
      rel="noreferrer"
      className="bg-muted text-muted-foreground! hover:text-foreground! ms-1 inline-flex items-center gap-1 rounded-full py-0.5 ps-1 pe-2 align-middle text-xs font-medium no-underline!"
    >
      <Favicon url={first} size={12} />
      {siteName(first)}
      {more.length > 0 && <span>+{more.length}</span>}
    </a>
  );
};

const SourceRow: FC<{ source: Source; index: number }> = ({ source, index }) => (
  <li className="flex gap-3">
    <span className="text-muted-foreground w-6 shrink-0 text-end text-sm tabular-nums">
      {index}
    </span>
    <a href={source.url} target="_blank" rel="noreferrer" className="group flex min-w-0 flex-col">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Favicon url={source.url} size={12} />
        {siteName(source.url)}
        {source.video && ` · ${source.video.channel}`}
      </span>
      <span className="group-hover:text-foreground text-foreground/85 line-clamp-2 text-sm">
        {source.title}
      </span>
    </a>
  </li>
);

export const PublishedAnswers: FC<{
  turns: { question: string; answer: string }[];
  sources: Source[];
}> = ({ turns, sources }) => {
  const t = useT();
  const cited = new Set(
    turns.flatMap((turn) => [...turn.answer.matchAll(CITED_URL)].map((match) => match[1])),
  );
  const shown = sources.filter((source) => cited.has(source.url));
  const rest = sources.filter((source) => !cited.has(source.url));

  return (
    <>
      {turns.map((turn, index) => (
        <section key={`${index}-${turn.question}`} className="mt-8">
          {index > 0 && (
            <h2 className="text-foreground mb-4 text-xl font-medium">{turn.question}</h2>
          )}
          <div className={answerText}>
            <Markdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={[rehypeKatex, rehypeCitations, rehypeNotes]}
              components={{ a: Anchor, aside: Note }}
            >
              {withMathDelimiters(unwrappedCitations(turn.answer))}
            </Markdown>
          </div>
        </section>
      ))}
      {sources.length > 0 && (
        <section className="border-border/60 mt-12 border-t pt-8">
          <h2 className="text-foreground mb-4 text-lg font-medium">{t("Sources")}</h2>
          <ol className="flex flex-col gap-3">
            {shown.map((source, index) => (
              <SourceRow key={source.url} source={source} index={index + 1} />
            ))}
          </ol>
          {rest.length > 0 && (
            <details className="mt-4">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                {t("{count} more sources", { count: rest.length })}
              </summary>
              <ol className="mt-3 flex flex-col gap-3">
                {rest.map((source, index) => (
                  <SourceRow key={source.url} source={source} index={shown.length + index + 1} />
                ))}
              </ol>
            </details>
          )}
        </section>
      )}
    </>
  );
};
