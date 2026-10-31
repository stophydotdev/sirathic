"use client";

import { Favicon } from "@/components/favicon";
import { siteName } from "@/components/sources";
import type { Article } from "@/content/discover/schema";
import type { FC } from "react";

type Paragraph = Article["summary"];

const ARABIC_RUN = /(\p{scx=Arabic}+(?:\s+\p{scx=Arabic}+)*)/u;

export const MixedText: FC<{ text: string }> = ({ text }) =>
  text.split(ARABIC_RUN).map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${index}${part}`} lang="ar" dir="rtl" className="font-quran text-xl">
        {part}
      </span>
    ) : (
      part
    ),
  );

const SourceTag: FC<{ citations: Paragraph["citations"] }> = ({ citations: [first, ...more] }) =>
  first && (
    <a
      href={first}
      target="_blank"
      rel="noreferrer"
      className="bg-muted text-muted-foreground hover:text-foreground ms-1 inline-flex items-center gap-1 rounded-full py-0.5 ps-1 pe-2 align-middle font-sans text-xs font-medium"
    >
      <Favicon url={first} size={12} />
      {siteName(first)}
      {more.length > 0 && <span>+{more.length}</span>}
    </a>
  );

export const Claim: FC<{ paragraph: Paragraph }> = ({ paragraph }) => (
  <p>
    <MixedText text={paragraph.text} />
    <SourceTag citations={paragraph.citations} />
  </p>
);
