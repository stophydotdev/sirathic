const ACTABLE =
  /^(?:button|link|textbox|searchbox|combobox|checkbox|radio|option|menuitem|menuitemcheckbox|menuitemradio|tab|switch|slider|spinbutton|gridcell|treeitem)$/u;
const FIELDS = /^(?:textbox|searchbox|spinbutton|combobox)$/u;
const LINE = /^(\s*)- (\w+)(?: "((?:[^"\\]|\\.)*)")?((?: \[[^\]]+\])*)(?::(?: (.*))?)?$/u;
const REF = /\[ref=(\w+)\]/u;
const FLAGS = /\[(checked|selected|expanded|pressed|disabled)(?:=\w+)?\]/gu;
const LABEL_CHARS = 120;
const VALUE_CHARS = 80;
const MAX_ELEMENTS = 250;

type Option = { label: string; chosen: boolean };

type Found = {
  ref: string;
  role: string;
  label: string;
  value: string;
  flags: string[];
} & ({ kind: "press" } | { kind: "field" } | { kind: "select"; options: Option[] });

export type PageElement = Found & { index: number };

const isLink = (element: Found) => element.kind === "press" && element.role === "link";

const unquoted = (text: string) => (text.startsWith('"') ? text.slice(1, -1) : text);

const rowsOf = (snapshot: string) =>
  snapshot.split("\n").flatMap((text) => {
    const found = LINE.exec(text);
    if (!found) return [];
    const [, indent = "", role = "", name = "", attributes = "", value = ""] = found;
    return [{ depth: indent.length, role, name, attributes, value }];
  });

export const elementsOf = (snapshot: string): PageElement[] => {
  const rows = rowsOf(snapshot);
  const found = rows.flatMap((row, at): Found[] => {
    const ref = REF.exec(row.attributes)?.[1];
    if (!ref || !ACTABLE.test(row.role)) return [];
    const flags = [...row.attributes.matchAll(FLAGS)].map((flag) => flag[0].slice(1, -1));
    const below = rows.slice(at + 1);
    const inside = below.findIndex((next) => next.depth <= row.depth);
    const nested = inside < 0 ? below : below.slice(0, inside);
    const named =
      row.name ||
      (row.role === "button"
        ? nested.map((next) => unquoted(next.value) || next.name).find(Boolean)
        : undefined) ||
      "";
    const options = nested
      .filter((next) => next.role === "option" && !REF.test(next.attributes))
      .map((option) => ({ label: option.name, chosen: option.attributes.includes("[selected]") }));
    const base = {
      ref,
      role: row.role,
      label: named.slice(0, LABEL_CHARS),
      value: unquoted(row.value).slice(0, VALUE_CHARS),
      flags,
    };
    if (row.role === "combobox" && options.length > 0) {
      return [{ ...base, kind: "select", options }];
    }
    return [{ ...base, kind: FIELDS.test(row.role) ? "field" : "press" }];
  });
  const kept = new Set(
    [...found.filter((element) => !isLink(element)), ...found.filter(isLink)].slice(
      0,
      MAX_ELEMENTS,
    ),
  );
  return found
    .filter((element) => kept.has(element))
    .map((element, at) => Object.assign({}, element, { index: at + 1 }));
};

const PROSE = /^(?:heading|paragraph|generic|text|status|alert|cell|term|definition)$/u;

export const textOf = (snapshot: string, limit: number) =>
  rowsOf(snapshot)
    .filter((row) => PROSE.test(row.role))
    .map((row) => unquoted(row.value) || row.name)
    .filter((text) => text !== "")
    .join("\n")
    .slice(0, limit);
