import { defineRule, eslintCompatPlugin } from "@oxlint/plugins";

const noCommentsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow comments; names and types carry the meaning.",
    },
    messages: {
      comment:
        "Remove this comment. Rename or restructure the code so it explains itself.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({ loc: comment.loc, messageId: "comment" });
        }
      },
    };
  },
});

export default eslintCompatPlugin({
  meta: { name: "sirathic" },
  rules: { "no-comments": noCommentsRule },
});
