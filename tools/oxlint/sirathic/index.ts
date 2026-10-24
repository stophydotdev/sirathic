import { defineRule, eslintCompatPlugin, type ESTree } from "@oxlint/plugins";

const TEST_FILE = /\.test\.tsx?$/u;
const TEST_CALLS: ReadonlySet<string> = new Set(["test", "it", "describe"]);
const SKIPS: ReadonlySet<string> = new Set(["only", "skip", "todo", "skipIf", "todoIf", "runIf"]);
const TIMERS: ReadonlySet<string> = new Set(["setTimeout", "setInterval"]);
const LOOPS: ReadonlySet<string> = new Set([
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
]);
const FUNCTIONS: ReadonlySet<string> = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);

const nameOf = (node: ESTree.Node): string | null =>
  node.type === "Identifier" ? node.name : null;

const testCall = (
  callee: ESTree.Node,
): { readonly base: string; readonly modifier: string | null } | null => {
  const base = nameOf(callee);
  if (base !== null) return TEST_CALLS.has(base) ? { base, modifier: null } : null;
  if (callee.type !== "MemberExpression") return null;
  const object = nameOf(callee.object);
  const property = nameOf(callee.property);
  return object !== null && property !== null && TEST_CALLS.has(object)
    ? { base: object, modifier: property }
    : null;
};

const isInsideLoop = (node: ESTree.Node): boolean => {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (LOOPS.has(current.type)) return true;
    if (FUNCTIONS.has(current.type)) return false;
  }
  return false;
};

const isZero = (node: ESTree.Node | undefined): boolean =>
  node?.type === "Literal" && node.value === 0;

const noWaitsInTests = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Tests never wait on the clock." },
    messages: {
      wait: "This test waits on the clock. Await the promise that marks the moment, or move the clock with setSystemTime.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!TEST_FILE.test(context.filename)) return;
        const { callee } = node;
        const timer = nameOf(callee);
        const sleeps =
          callee.type === "MemberExpression" &&
          nameOf(callee.object) === "Bun" &&
          nameOf(callee.property) === "sleep" &&
          !isZero(node.arguments[0]);
        if (sleeps || (timer !== null && TIMERS.has(timer))) {
          context.report({ node: callee, messageId: "wait" });
        }
      },
    };
  },
});

const noTestTimeoutsOrSkips = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Tests have no per-test timeout and are never skipped or focused." },
    messages: {
      timeout:
        "Drop the per-test timeout. A test that needs one is waiting on something it should await.",
      skip: "Remove .{{ modifier }}. Fix or delete the test instead.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!TEST_FILE.test(context.filename)) return;
        const call = testCall(node.callee);
        if (call === null) return;
        if (call.modifier !== null && SKIPS.has(call.modifier)) {
          context.report({
            node: node.callee,
            messageId: "skip",
            data: { modifier: call.modifier },
          });
        } else if (call.modifier === null && node.arguments.length > 2) {
          context.report({ node: node.arguments[2] ?? node, messageId: "timeout" });
        }
      },
    };
  },
});

const noTestInLoop = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Tests are not declared inside loops." },
    messages: {
      loop: "Do not declare {{ name }}() inside a loop. Use {{ name }}.each(cases) instead.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!TEST_FILE.test(context.filename)) return;
        const call = testCall(node.callee);
        if (call === null || call.modifier !== null || !isInsideLoop(node)) return;
        context.report({ node: node.callee, messageId: "loop", data: { name: call.base } });
      },
    };
  },
});

export default eslintCompatPlugin({
  meta: { name: "sirathic" },
  rules: {
    "no-test-in-loop": noTestInLoop,
    "no-test-timeouts-or-skips": noTestTimeoutsOrSkips,
    "no-waits-in-tests": noWaitsInTests,
  },
});
