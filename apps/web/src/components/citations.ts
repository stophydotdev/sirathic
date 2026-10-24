import type { Element, Root, RootContent } from "hast";
import { z } from "zod";

const href = z.string();

function citationUrl(node: RootContent) {
  if (node.type !== "element" || node.tagName !== "a") return undefined;
  const [text, ...rest] = node.children;
  if (rest.length > 0 || text?.type !== "text" || !/^\d+$/.test(text.value))
    return undefined;
  return href.safeParse(node.properties.href).data;
}

const isBlank = (node: RootContent) =>
  node.type === "text" && node.value.trim() === "";

function group<T extends RootContent>(children: T[]) {
  const out: (T | Element)[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const first = citationUrl(node);
    if (!first) {
      out.push(node);
      continue;
    }
    const urls = [first];
    let next = i + 1;
    while (next < children.length) {
      let after = next;
      while (after < children.length && isBlank(children[after])) after++;
      const url =
        after < children.length ? citationUrl(children[after]) : undefined;
      if (!url) break;
      if (!urls.includes(url)) urls.push(url);
      next = after + 1;
    }
    out.push({
      type: "element",
      tagName: "a",
      properties: { href: first, dataUrls: urls },
      children: [],
    });
    i = next - 1;
  }
  return out;
}

function walk(parent: Root | Element) {
  if (parent.type === "root") parent.children = group(parent.children);
  else parent.children = group(parent.children);
  for (const child of parent.children)
    if (child.type === "element") walk(child);
}

export const rehypeCitations = () => (tree: Root) => walk(tree);

const citedUrls = z.array(z.string());
const verseUrl = /^https:\/\/quran\.com\/\d+\/\d+$/u;
const ENDS_INSIDE = new Set(["li", "td", "th"]);
const FOLLOWS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6"]);

const urlsIn = (node: Element): string[] =>
  node.tagName === "a"
    ? (citedUrls.safeParse(node.properties.dataUrls).data ?? [])
    : node.children.flatMap((child) =>
        child.type === "element" ? urlsIn(child) : [],
      );

const versesIn = (node: Element) =>
  urlsIn(node).filter((url) => verseUrl.test(url));

const quotedVerses = (node: Element, seen: ReadonlySet<string>) => {
  if (node.tagName !== "blockquote") return [];
  const urls = [...new Set(urlsIn(node))];
  return urls.length > 0 &&
    urls.every((url) => verseUrl.test(url) && !seen.has(url))
    ? urls
    : [];
};

const verseFigure = (url: string, quote: Element[]): Element => ({
  type: "element",
  tagName: "figure",
  properties: { dataVerse: url },
  children: quote,
});

function placeVerses<T extends RootContent>(children: T[], seen: Set<string>) {
  const out: (T | Element)[] = [];
  for (const child of children) {
    const quoted = child.type === "element" ? quotedVerses(child, seen) : [];
    if (child.type === "element" && quoted.length > 0) {
      for (const url of quoted) seen.add(url);
      out.push(
        ...quoted.map((url, index) =>
          verseFigure(url, index === 0 ? [child] : []),
        ),
      );
      continue;
    }
    out.push(child);
    if (child.type !== "element") continue;
    child.children = placeVerses(child.children, seen);
    const endsInside = ENDS_INSIDE.has(child.tagName);
    if (!endsInside && !FOLLOWS.has(child.tagName)) continue;
    const fresh = [...new Set(versesIn(child))].filter((url) => !seen.has(url));
    for (const url of fresh) seen.add(url);
    const blocks = fresh.map((url) => verseFigure(url, []));
    if (endsInside) child.children.push(...blocks);
    else out.push(...blocks);
  }
  return out;
}

export const rehypeVerses = () => (tree: Root) => {
  tree.children = placeVerses(tree.children, new Set());
};

const pendingCitation = /\[\d+\](\([^)\s]*)?$|\[\d*$/;

export const hidePendingCitation = (text: string) =>
  text.replace(pendingCitation, "");
