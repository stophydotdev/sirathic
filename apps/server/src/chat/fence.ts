import type { ToolResultPart } from "ai";

const OPEN = "<untrusted_data>\n";
const CLOSE = "\n</untrusted_data>";
const MARKER = /untrusted_data/giu;

const inert = (text: string) => text.replace(MARKER, "untrusted-data");

export const fencedText = (text: string) => OPEN + inert(text) + CLOSE;

export const fenced = (output: ToolResultPart["output"]): ToolResultPart["output"] => {
  switch (output.type) {
    case "text":
      return { ...output, value: fencedText(output.value) };
    case "json":
      return { type: "text", value: fencedText(JSON.stringify(output.value)) };
    case "content":
      return {
        ...output,
        value: [
          { type: "text", text: OPEN },
          ...output.value.map((part) =>
            part.type === "text" ? { ...part, text: inert(part.text) } : part,
          ),
          { type: "text", text: CLOSE },
        ],
      };
    default:
      return output;
  }
};
