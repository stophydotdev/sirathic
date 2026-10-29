import type { Source } from "@sirathic/server/sources";
import type { ExternalHyperlink, Paragraph, Table, TextRun } from "docx";

type Listed = Pick<Source, "title" | "url">;
type Answer = { title: string; parts: HTMLElement[]; sources: Listed[]; heading: string };
type Style = { bold?: boolean; italics?: boolean; code?: boolean };

const fileName = (title: string, extension: string) =>
  `${
    title
      .replaceAll(/[^\p{L}\p{N} -]/gu, "")
      .trim()
      .slice(0, 60) || "answer"
  }.${extension}`;

export function saveFile(title: string, extension: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName(title, extension);
  link.click();
  URL.revokeObjectURL(url);
}

export const answerParts = (root: Element) =>
  [...root.querySelectorAll(".aui-md")].flatMap((part) => {
    const copy = part.cloneNode(true);
    if (!(copy instanceof HTMLElement)) return [];
    for (const extra of copy.querySelectorAll("img, svg, button, .aui-code-header-root"))
      extra.remove();
    for (const more of copy.querySelectorAll("a > span:last-child")) {
      if (/^\+\d+$/u.test(more.textContent ?? "")) more.remove();
    }
    return [copy];
  });

const PRINT_STYLE = `body{font:12pt/1.55 Georgia,serif;color:#111;margin:2cm}
h1{font-size:20pt;margin:0 0 16pt}h2{font-size:15pt}h3{font-size:13pt}
a{color:inherit}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4pt 6pt}
pre{white-space:pre-wrap;font:10pt monospace}ol.sources{font-size:10pt}`;

export function printAnswer({ title, parts, sources, heading }: Answer) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const page = frame.contentDocument;
  const view = frame.contentWindow;
  if (!page || !view) {
    frame.remove();
    return;
  }
  page.documentElement.lang = document.documentElement.lang;
  page.documentElement.dir = document.documentElement.dir;
  page.title = title;
  const style = page.createElement("style");
  style.textContent = PRINT_STYLE;
  const named = page.createElement("h1");
  named.textContent = title;
  page.head.append(style);
  page.body.append(named, ...parts.map((part) => page.importNode(part, true)));
  if (sources.length > 0) {
    const listed = page.createElement("h2");
    listed.textContent = heading;
    const list = page.createElement("ol");
    list.className = "sources";
    for (const source of sources) {
      const link = page.createElement("a");
      link.href = source.url;
      link.textContent = source.title;
      const item = page.createElement("li");
      item.append(link);
      list.append(item);
    }
    page.body.append(listed, list);
  }
  view.addEventListener("afterprint", () => frame.remove());
  view.print();
}

const LIST_TAGS = new Set(["UL", "OL"]);

export async function wordAnswer({ title, parts, sources, heading }: Answer) {
  const docx = await import("docx");
  const rtl = document.documentElement.dir === "rtl";
  const headings = {
    H1: docx.HeadingLevel.HEADING_1,
    H2: docx.HeadingLevel.HEADING_2,
    H3: docx.HeadingLevel.HEADING_3,
    H4: docx.HeadingLevel.HEADING_4,
  };
  let lists = 0;

  const runs = (node: Node, style: Style): (TextRun | ExternalHyperlink)[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return text.split("\n").map(
        (line, at) =>
          new docx.TextRun({
            text: line,
            break: at > 0 ? 1 : undefined,
            bold: style.bold,
            italics: style.italics,
            font: style.code ? "Courier New" : undefined,
            rightToLeft: rtl,
          }),
      );
    }
    if (!(node instanceof HTMLElement)) return [];
    if (node.tagName === "BR") return [new docx.TextRun({ text: "", break: 1 })];
    if (node instanceof HTMLAnchorElement && node.href) {
      return [
        new docx.ExternalHyperlink({
          link: node.href,
          children: [
            new docx.TextRun({
              text: node.textContent ?? "",
              style: "Hyperlink",
              rightToLeft: rtl,
            }),
          ],
        }),
      ];
    }
    const next = {
      bold:
        style.bold || node.tagName === "STRONG" || node.tagName === "B" || node.tagName === "TH",
      italics: style.italics || node.tagName === "EM" || node.tagName === "I",
      code: style.code || node.tagName === "CODE",
    };
    return [...node.childNodes].flatMap((child) => runs(child, next));
  };

  const listBlocks = (list: Element, level: number): (Paragraph | Table)[] => {
    lists += 1;
    const instance = lists;
    const ordered = list.tagName === "OL";
    return [...list.children].flatMap((item) => {
      const found: (Paragraph | Table)[] = [
        new docx.Paragraph({
          children: [...item.childNodes]
            .filter((child) => !(child instanceof Element && LIST_TAGS.has(child.tagName)))
            .flatMap((child) => runs(child, {})),
          ...(ordered
            ? { numbering: { reference: "numbers", level, instance } }
            : { bullet: { level } }),
          bidirectional: rtl,
        }),
      ];
      for (const child of item.children) {
        if (LIST_TAGS.has(child.tagName)) found.push(...listBlocks(child, Math.min(level + 1, 2)));
      }
      return found;
    });
  };

  const blocks = (parent: Element): (Paragraph | Table)[] =>
    [...parent.children].flatMap((child) => {
      const tag = child.tagName;
      if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4") {
        return [
          new docx.Paragraph({
            heading: headings[tag],
            children: runs(child, {}),
            bidirectional: rtl,
          }),
        ];
      }
      if (tag === "P")
        return [new docx.Paragraph({ children: runs(child, {}), bidirectional: rtl })];
      if (tag === "PRE") return [new docx.Paragraph({ children: runs(child, { code: true }) })];
      if (LIST_TAGS.has(tag)) return listBlocks(child, 0);
      if (tag === "TABLE") {
        return [
          new docx.Table({
            width: { size: 100, type: docx.WidthType.PERCENTAGE },
            rows: [...child.querySelectorAll("tr")].map(
              (row) =>
                new docx.TableRow({
                  children: [...row.children].map(
                    (cell) =>
                      new docx.TableCell({
                        children: [
                          new docx.Paragraph({ children: runs(cell, {}), bidirectional: rtl }),
                        ],
                      }),
                  ),
                }),
            ),
          }),
        ];
      }
      if (tag === "HR") return [];
      return blocks(child);
    });

  const listed = sources.map(
    (source) =>
      new docx.Paragraph({
        numbering: { reference: "numbers", level: 0, instance: lists + 1 },
        children: [
          new docx.ExternalHyperlink({
            link: source.url,
            children: [new docx.TextRun({ text: source.title, style: "Hyperlink" })],
          }),
        ],
      }),
  );
  const body = [
    new docx.Paragraph({
      heading: docx.HeadingLevel.TITLE,
      children: [new docx.TextRun({ text: title, rightToLeft: rtl })],
      bidirectional: rtl,
    }),
    ...parts.flatMap(blocks),
    ...(listed.length > 0
      ? [
          new docx.Paragraph({
            heading: docx.HeadingLevel.HEADING_2,
            children: [new docx.TextRun({ text: heading, rightToLeft: rtl })],
            bidirectional: rtl,
          }),
          ...listed,
        ]
      : []),
  ];
  const file = new docx.Document({
    numbering: {
      config: [
        {
          reference: "numbers",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: docx.LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: docx.AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children: body }],
  });
  saveFile(title, "docx", await docx.Packer.toBlob(file));
}
