import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

const DIRECTIVE =
  /^\s*(?:(?:oxlint|eslint)-(?:disable|enable)|@ts-expect-error|\/\s*<reference\b|SAFETY\s*:|[@#]__(?:PURE|NO_SIDE_EFFECTS)__)/u;

const spanOf = (text: string, start: number, end: number): [number, number] => {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const newline = text.indexOf("\n", end);
  const lineEnd = newline === -1 ? text.length : newline;
  if (text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === "") {
    return [lineStart, newline === -1 ? lineEnd : newline + 1];
  }
  let from = start;
  while (from > lineStart && (text[from - 1] === " " || text[from - 1] === "\t")) from -= 1;
  return text.slice(end, lineEnd).trim() === "" ? [from, end] : [start, end];
};

const noCommentsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Code carries no comments. Names and small functions say what it does." },
    fixable: "code",
    messages: { comment: "Delete this comment. Names and small functions say what the code does." },
  },
  createOnce(context) {
    const jsxHolders: { start: number; end: number }[] = [];
    return {
      Program() {
        jsxHolders.length = 0;
      },
      JSXExpressionContainer(node) {
        if (node.expression.type === "JSXEmptyExpression") jsxHolders.push(node);
      },
      "Program:exit"() {
        const { text } = context.sourceCode;
        for (const comment of context.sourceCode.getAllComments()) {
          if (DIRECTIVE.test(comment.value)) continue;
          const holder = jsxHolders.find(
            (node) => node.start <= comment.start && comment.end <= node.end,
          );
          const [from, to] =
            holder === undefined ? [comment.start, comment.end] : [holder.start, holder.end];
          context.report({
            node: comment,
            messageId: "comment",
            fix: (fixer) => fixer.removeRange(spanOf(text, from, to)),
          });
        }
      },
    };
  },
});

const LINT_DIRECTIVE =
  /^\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?\b(?:[^-]|-(?!-))*(?:--(.*))?$/su;
const TYPE_DIRECTIVE = /^\s*@ts-(?:expect-error|ignore|nocheck)(?![\w-])(.*)$/su;

const reasonOf = (comment: string): string | null => {
  const lint = LINT_DIRECTIVE.exec(comment);
  if (lint !== null) return lint[1] ?? "";
  const type = TYPE_DIRECTIVE.exec(comment);
  return type === null ? null : (type[1] ?? "").replace(/^[\s:-]+/u, "");
};

const requireReasonRule = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Every lint or type-check suppression says why." },
    messages: {
      reason:
        "Say why: end it with `-- reason` for a lint rule, or write the reason after @ts-expect-error.",
    },
  },
  createOnce(context) {
    return {
      "Program:exit"() {
        for (const comment of context.sourceCode.getAllComments()) {
          const reason = reasonOf(comment.value);
          if (reason !== null && reason.trim() === "") {
            context.report({ node: comment, messageId: "reason" });
          }
        }
      },
    };
  },
});

const commentsPlugin = eslintCompatPlugin({
  meta: { name: "comments" },
  rules: { "no-comments": noCommentsRule, "require-reason": requireReasonRule },
});

export default commentsPlugin;
