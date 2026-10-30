"use client";

import type { FC } from "react";
import { ShikiHighlighter } from "react-shiki/web";

import { cn } from "@/lib/utils";

const CodeHighlighter: FC<{ language: string; code: string; wrapped: boolean }> = ({
  language,
  code,
  wrapped,
}) => (
  <ShikiHighlighter
    language={language}
    theme={{ light: "github-light", dark: "github-dark" }}
    defaultColor="light"
    addDefaultStyles={false}
    showLanguage={false}
    className={cn(
      "text-[13px] leading-relaxed [&_pre]:bg-muted/45!",
      wrapped && "[&_pre]:wrap-break-word [&_pre]:whitespace-pre-wrap",
    )}
  >
    {code.trimEnd()}
  </ShikiHighlighter>
);

export default CodeHighlighter;
