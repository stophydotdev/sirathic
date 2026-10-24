import { evaluate, format, isFunctionNode, isUnit, parse, typeOf } from "mathjs";
import { z } from "zod";

const MAX_LENGTH = 200;
const PRECISION = 14;
const PERCENT_OF = /(\d+(?:\.\d+)?)\s*%\s*of\s+/giu;

const ALLOWED_NODES = new Set([
  "ConstantNode",
  "SymbolNode",
  "OperatorNode",
  "ParenthesisNode",
  "FunctionNode",
  "ArrayNode",
]);

const ALLOWED_FUNCTIONS = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "atan2",
  "cbrt",
  "ceil",
  "cos",
  "cosh",
  "cube",
  "exp",
  "factorial",
  "fix",
  "floor",
  "gcd",
  "hypot",
  "lcm",
  "log",
  "log2",
  "log10",
  "max",
  "mean",
  "median",
  "min",
  "mod",
  "nthRoot",
  "pow",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "square",
  "sum",
  "tan",
  "tanh",
  "to",
]);

export const calculatorInput = z.object({
  expression: z
    .string()
    .trim()
    .min(1)
    .max(MAX_LENGTH)
    .describe('Math or unit conversion: "15% of 2400", "5 km to miles", "sqrt(144) + 2^3"'),
});

const isUnsafe = (expression: string) =>
  parse(expression).filter(
    (node) =>
      !ALLOWED_NODES.has(node.type) ||
      (isFunctionNode(node) && !ALLOWED_FUNCTIONS.has(node.fn.name)),
  ).length > 0;

export const calculator = (input: z.input<typeof calculatorInput>) => {
  const { expression } = calculatorInput.parse(input);
  const interpreted = expression.replaceAll(PERCENT_OF, "($1/100)*");
  try {
    if (isUnsafe(interpreted)) {
      throw new Error("Expression uses syntax or functions that are not allowed");
    }
    const result: unknown = evaluate(interpreted, {});
    if (typeOf(result) === "function") {
      throw new Error("Expression does not produce a value");
    }
    const unit = isUnit(result) ? result.formatUnits() : null;
    const value =
      isUnit(result) && unit !== null
        ? result.toNumber(unit)
        : typeOf(result) === "number"
          ? Number(result)
          : null;
    return {
      expression,
      interpreted,
      result: format(result, { precision: PRECISION }),
      value,
      unit,
      source: "mathjs (computed locally)",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Cannot evaluate "${expression}": ${reason}`, {
      cause: error,
    });
  }
};
