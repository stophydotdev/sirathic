import type { StreamTextTransform, TextStreamPart, ToolSet, UIMessage } from "ai";
import type { ChatMessage } from "../shared/messages";
import { withoutEmDashes } from "./compact";

const URL_PART = String.raw`(?:[^()\s]|\([^()\s]*\))+`;
const LINKED = new RegExp(String.raw`\[(\d+)\]\((${URL_PART})\)`, "g");
const CITATION = new RegExp(String.raw`( ?)\[(\d+)\](?:\((${URL_PART})\))?`, "g");

export const unlinked = (text: string) => text.replace(LINKED, "[$1]");

export const withBareCitations = (message: ChatMessage): ChatMessage =>
  message.role === "assistant"
    ? {
        ...message,
        parts: message.parts.map((part) =>
          part.type === "text" ? { ...part, text: unlinked(part.text) } : part,
        ),
      }
    : message;
const NATIVE = /( ?)\ue200cite\ue202([^\ue201]*)\ue201/g;
const PRIVATE_USE = /[\ue000-\uf8ff]/g;
const UNFINISHED = /^\[(?:\d*(\](\([^)\s]*)?)?|[a-z]{1,5}(?::\d*\]?)?)$/;
const IMAGE = /\[image:(\d+)\]/g;
const QURAN_URL = /^https:\/\/quran\.com\/(\d+)\/(\d+)$/;
const VERSE_KEY = /\b(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;
const PARAGRAPH = "\n\n";
const CITED = new RegExp(
  String.raw`\[\d+\](?:\(${URL_PART}\))?|\ue200cite\ue202[^\ue201]*\ue201`,
  "g",
);
const TRAILING = /[\s\u2014]+$/u;
const FENCE = /^ {0,3}```/gmu;

const inCode = (text: string) =>
  (text.match(FENCE)?.length ?? 0) % 2 === 1 ||
  (text.slice(text.lastIndexOf("\n") + 1).match(/`/gu)?.length ?? 0) % 2 === 1;

const paragraphOf = (text: string) => {
  const start = text.lastIndexOf(PARAGRAPH);
  return start === -1 ? text : text.slice(start + PARAGRAPH.length);
};

const sinceLastCitation = (text: string) => {
  const last = [...text.matchAll(CITED)].at(-1);
  return last === undefined ? text : text.slice(last.index + last[0].length);
};

function holdFrom(text: string) {
  const native = text.lastIndexOf("\ue200");
  const nativeOpen = native !== -1 && !text.includes("\ue201", native) ? native : text.length;
  const bracket = text.lastIndexOf("[");
  const bracketOpen =
    bracket !== -1 && UNFINISHED.test(text.slice(bracket)) ? bracket : text.length;
  return Math.min(nativeOpen, bracketOpen, TRAILING.exec(text)?.index ?? text.length);
}

export function citations(history: UIMessage[]) {
  const byUrl = new Map<string, number>();
  const byNumber = new Map<number, string>();
  const remember = (number: number, url: string) => {
    if (byUrl.has(url) || byNumber.has(number)) return;
    byUrl.set(url, number);
    byNumber.set(number, url);
  };
  for (const message of history.filter((entry) => entry.role === "assistant")) {
    for (const part of message.parts) {
      if (part.type === "text")
        for (const [, number, url] of part.text.matchAll(LINKED))
          if (url) remember(Number(number), url);
    }
  }

  const add = (url: string) => {
    const known = byUrl.get(url);
    if (known !== undefined) return known;
    const number = Math.max(0, ...byNumber.keys()) + 1;
    remember(number, url);
    return number;
  };

  const images: { url: string; title: string }[] = [];
  const addImage = (image: { url: string; title: string }) => images.push(image);
  const imageOf = (number: string) => {
    const image = images[Number(number) - 1];
    return image ? `![${image.title.replaceAll(/[[\]()]/gu, "")}](${image.url})` : "";
  };

  const verseCited = (number: number, before: string) => {
    const cited = QURAN_URL.exec(byNumber.get(number) ?? "");
    if (!cited) return number;
    const [surah, ayah] = [Number(cited[1]), Number(cited[2])];
    const named = [...sinceLastCitation(paragraphOf(before)).matchAll(VERSE_KEY)].map(
      ([, namedSurah, from, to]) => ({
        surah: Number(namedSurah),
        from: Number(from),
        to: Number(to ?? from),
      }),
    );
    const last = named.at(-1);
    if (
      last === undefined ||
      named.some((verse) => verse.surah === surah && verse.from <= ayah && ayah <= verse.to)
    )
      return number;
    return byUrl.get(`https://quran.com/${last.surah}/${last.from}`) ?? number;
  };

  const link = (text: string, before = "") =>
    withoutEmDashes(text)
      .replace(NATIVE, (_, space: string, payload: string) => {
        const number = byUrl.get(payload.trim());
        return number === undefined ? "" : `${space}[${number}](${payload.trim()})`;
      })
      .replace(PRIVATE_USE, "")
      .replace(
        CITATION,
        (
          found: string,
          space: string,
          raw: string,
          url: string | undefined,
          offset: number,
          whole: string,
        ) => {
          const context = before + whole.slice(0, offset);
          if (inCode(context)) return found;
          const written = url === undefined ? Number(raw) : (byUrl.get(url) ?? Number(raw));
          const number = written === undefined ? undefined : verseCited(written, context);
          const target = number === undefined ? undefined : byNumber.get(number);
          return target === undefined ? "" : `${space}[${number}](${target})`;
        },
      )
      .replace(IMAGE, (_, number: string) => imageOf(number));

  function transform<TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> {
    return () => {
      let pending = "";
      let id = "";
      let streamed = "";
      const linked = (text: string) => {
        const result = link(text, streamed);
        streamed += text;
        return result;
      };
      const flush = (controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>) => {
        if (pending) controller.enqueue({ type: "text-delta", id, text: linked(pending) });
        pending = "";
      };
      return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
        transform(part, controller) {
          if (part.type !== "text-delta") {
            flush(controller);
            controller.enqueue(part);
            return;
          }
          id = part.id;
          pending += part.text;
          const cut = holdFrom(pending);
          const ready = pending.slice(0, cut);
          pending = pending.slice(cut);
          if (ready) controller.enqueue({ ...part, text: linked(ready) });
        },
        flush,
      });
    };
  }

  return { add, addImage, link, numberOf: (url: string) => byUrl.get(url), transform };
}
