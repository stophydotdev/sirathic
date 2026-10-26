import { Favicon } from "@/components/favicon";
import { MentionIcon } from "@/components/mentionIcon";
import { type MentionTarget, splitMentions } from "@/components/mentionText";
import { Fragment, type FC } from "react";

const urlPattern = /https?:\/\/[^\s<>]+/g;
const trailingPunctuation = /[.,)!?:;"'”’]+$/;

type TextPart = { kind: "text" | "link"; value: string };

export const splitLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(urlPattern)) {
    const link = match[0].replace(trailingPunctuation, "");
    if (match.index > cursor) parts.push({ kind: "text", value: text.slice(cursor, match.index) });
    parts.push({ kind: "link", value: link });
    cursor = match.index + link.length;
  }
  if (cursor < text.length) parts.push({ kind: "text", value: text.slice(cursor) });
  return parts;
};

export const LinkedText: FC<{ text: string; targets: readonly MentionTarget[] }> = ({
  text,
  targets,
}) =>
  splitLinks(text).map((part, i) =>
    part.kind === "link" ? (
      <a
        key={i}
        href={part.value}
        target="_blank"
        rel="noreferrer"
        className="text-super break-all hover:underline"
      >
        <Favicon url={part.value} size={14} className="me-1 inline-block align-[-2px]" />
        {part.value}
      </a>
    ) : (
      <Fragment key={i}>
        {splitMentions(part.value, targets).map((piece, j) =>
          piece.kind === "mention" ? (
            <span key={j} className="font-medium">
              <MentionIcon target={piece.target} className="me-1 align-[-3px]" />
              {piece.target.name}
            </span>
          ) : (
            piece.value
          ),
        )}
      </Fragment>
    ),
  );
