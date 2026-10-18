"use client";

import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import type { FC } from "react";
import { ShikiHighlighter } from "react-shiki/web";

const CodeHighlighter: FC<SyntaxHighlighterProps> = ({ language, code }) => (
  <ShikiHighlighter
    language={language}
    theme={{ light: "github-light", dark: "github-dark" }}
    defaultColor="light"
    addDefaultStyles={false}
    showLanguage={false}
    className="text-[13px] leading-relaxed [&_pre]:bg-muted/45!"
  >
    {code.trimEnd()}
  </ShikiHighlighter>
);

export default CodeHighlighter;
