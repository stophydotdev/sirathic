import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

type PageDocument = ReturnType<typeof parseHTML>["document"];
type PageElement = NonNullable<ReturnType<PageDocument["querySelector"]>>;

const DROPPED =
  "script, style, noscript, template, svg, iframe, object, embed, canvas, link, meta, head, form, button, select, input, textarea, dialog, audio, video, source, img, picture";
const CHROME =
  "nav, aside, footer, [role=navigation], [role=banner], [role=contentinfo], [role=complementary], [role=search], [role=dialog], [role=alertdialog], [aria-modal=true], [aria-hidden=true], [hidden], [style*='display:none' i], [style*='display: none' i]";
const NOISE_WORDS = [
  "cookie",
  "consent",
  "gdpr",
  "newsletter",
  "sidebar",
  "breadcrumb",
  "advert",
  "sponsor",
  "social",
  "related",
  "recommend",
  "popup",
  "toolbar",
  "skip-link",
  "no_print",
  "no-print",
  "noprint",
  "permalink",
  "structured-data",
];
const NOISE = NOISE_WORDS.flatMap((word) => [`[class*="${word}" i]`, `[id*="${word}" i]`]).join(
  ", ",
);
const MAIN_AREAS = [
  "main",
  "[role=main]",
  "#main",
  "#content",
  "#main-content",
  ".main-content",
  "article",
];
const SITE_NOISE = [
  ["islamqa.org", ".qa-card-list"],
  ["quran.com", '[class*="continueReading" i]'],
] as const;
const HEADINGS = "h1, h2, h3, h4, h5, h6";
const STRUCTURE = `p, ul, ol, table, blockquote, pre, ${HEADINGS}`;
const TAIL_HEADING =
  /^\s*(related|see also|more (from|on|stories|articles)|recommended|you (may|might) also like|trending|popular|most read|read more|share|comments?|ذات صلة|مواضيع ذات صلة|فتاوى ذات صلة|اقرأ أيضا|اقرأ أيضًا|شارك)\b/iu;
const MIN_MAIN_CHARS = 200;
const MAIN_SHARE = 0.5;
const NOISE_SHARE = 0.6;
const LINK_DENSE = 0.8;
const MIN_LIST_ITEMS = 3;
const MIN_WORD_BLOCKS = 3;
const MAX_WORD_CHARS = 30;
const CELL = "\u0001";
const ROW = "\u0002";

const squeezed = (text: string | null | undefined) => (text ?? "").replaceAll(/\s+/gu, " ").trim();

const textLength = (element: PageElement | null) => squeezed(element?.textContent).length;

const linkDensity = (element: PageElement) => {
  const total = textLength(element);
  if (total === 0) return 0;
  const linked = [...element.querySelectorAll("a")].reduce(
    (sum, link) => sum + textLength(link),
    0,
  );
  return linked / total;
};

const titleOf = (document: PageDocument) => {
  const meta = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  return (
    squeezed(document.querySelector("title")?.textContent) ||
    squeezed(meta) ||
    squeezed(document.querySelector("h1")?.textContent)
  );
};

const mainAreaOf = (document: PageDocument) => {
  const main = document.querySelector("main, [role=main]");
  const articles = [...(main ?? document).querySelectorAll("article")];
  const [only] = articles;
  if (
    articles.length === 1 &&
    only !== undefined &&
    textLength(only) >= MAIN_SHARE * textLength(main ?? document.documentElement)
  ) {
    return only;
  }
  return MAIN_AREAS.flatMap((selector) => document.querySelector(selector) ?? []).find(
    (area) => textLength(area) >= MIN_MAIN_CHARS,
  );
};

const removeNoise = (root: PageElement, selector: string) => {
  const rootChars = textLength(root);
  for (const element of root.querySelectorAll(selector)) {
    if (textLength(element) <= NOISE_SHARE * rootChars) element.remove();
  }
};

const sectionStart = (heading: PageElement, root: PageElement) => {
  let start = heading;
  while (
    start.parentElement !== null &&
    start.parentElement !== root &&
    start.parentElement.children.length === 1
  ) {
    start = start.parentElement;
  }
  return start;
};

const dropRelatedSections = (root: PageElement) => {
  for (const heading of root.querySelectorAll(HEADINGS)) {
    if (!TAIL_HEADING.test(squeezed(heading.textContent))) continue;
    const start = sectionStart(heading, root);
    for (
      let next = start.nextElementSibling;
      next !== null && linkDensity(next) >= LINK_DENSE;
      next = start.nextElementSibling
    ) {
      next.remove();
    }
    start.remove();
  }
};

const dropLinkLists = (root: PageElement) => {
  for (const list of root.querySelectorAll("ul, ol")) {
    const items = list.querySelectorAll("li").length;
    if (items >= MIN_LIST_ITEMS && linkDensity(list) >= LINK_DENSE) {
      list.remove();
    }
  }
};

const isShortBlock = (element: PageElement) =>
  element.tagName === "DIV" &&
  element.querySelector(STRUCTURE) === null &&
  textLength(element) <= MAX_WORD_CHARS;

const joinWordBlocks = (root: PageElement) => {
  for (const parent of root.querySelectorAll("div")) {
    const blocks = [...parent.children];
    if (blocks.length < MIN_WORD_BLOCKS || !blocks.every(isShortBlock)) continue;
    const line = parent.ownerDocument.createElement("p");
    line.textContent = blocks.map((block) => squeezed(block.textContent)).join(" ");
    parent.replaceChildren(line);
  }
};

const absolute = (value: string, base: string) => {
  if (!URL.canParse(value, base)) return null;
  const url = new URL(value, base);
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
};

const fixLinks = (root: PageElement, base: string) => {
  for (const anchor of root.querySelectorAll("a")) {
    const url = absolute(anchor.getAttribute("href") ?? "", base);
    const samePage =
      url !== null && url.hash !== "" && url.href.split("#")[0] === base.split("#")[0];
    if (url === null || samePage) {
      anchor.replaceWith(...anchor.childNodes);
    } else if (squeezed(anchor.textContent) === "") {
      anchor.remove();
    } else {
      anchor.setAttribute("href", url.href);
    }
  }
};

const siteNoiseFor = (base: string) => {
  const host = new URL(base).hostname.replace(/^www\./u, "");
  return SITE_NOISE.find(([site]) => host === site || host.endsWith(`.${site}`))?.[1];
};

const selectedArea = (document: PageDocument) => {
  const area = mainAreaOf(document);
  if (area !== undefined) return area;
  const content = new Readability(document).parse()?.content;
  if (content === undefined || content === null) return document.documentElement;
  return parseHTML(`<html><body>${content}</body></html>`).document.documentElement;
};

const cleanedArea = (document: PageDocument, base: string) => {
  const siteNoise = siteNoiseFor(base);
  const dropped = siteNoise === undefined ? DROPPED : `${DROPPED}, ${siteNoise}`;
  for (const element of document.querySelectorAll(dropped)) element.remove();
  const root = selectedArea(document);
  removeNoise(root, CHROME);
  removeNoise(root, NOISE);
  dropRelatedSections(root);
  dropLinkLists(root);
  joinWordBlocks(root);
  fixLinks(root, base);
  return root;
};

const cellText = (content: string) => squeezed(content).replaceAll("|", "\\|");

const tableLine = (cells: string[]) => `| ${cells.join(" | ")} |`;

const tableMarkdown = (content: string) => {
  const rows = content
    .split(ROW)
    .map((row) => row.split(CELL).slice(0, -1))
    .filter((cells) => cells.length > 0);
  const [header, ...body] = rows;
  if (header === undefined) return "";
  const divider = tableLine(header.map(() => "---"));
  return `\n\n${[tableLine(header), divider, ...body.map(tableLine)].join("\n")}\n\n`;
};

const converter = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});
converter.addRule("cell", {
  filter: ["td", "th"],
  replacement: (content) => `${cellText(content)}${CELL}`,
});
converter.addRule("row", {
  filter: "tr",
  replacement: (content) => `${ROW}${content}`,
});
converter.addRule("table", {
  filter: "table",
  replacement: tableMarkdown,
});

const tidy = (markdown: string) =>
  markdown
    .replaceAll(/[ \t]+$/gmu, "")
    .replaceAll(/(?<=\S)[ \t]{2,}/gu, " ")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();

export const htmlToMarkdown = (html: string, url: string) => {
  const { document } = parseHTML(html);
  const title = titleOf(document);
  const root = cleanedArea(document, url);
  return { title, markdown: tidy(converter.turndown(root.outerHTML)) };
};
