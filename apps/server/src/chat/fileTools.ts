import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { reasonOf } from "../http";
import type { codeSandbox } from "./codeTools";
import { type BotDisk, diskName } from "../bots/disk";
import { mediaTypeOf } from "../files/sniff";
import { fileName, saveFile } from "../files/store";
import { FILE_NAME_MAX, formatSize, MAX_FILE_BYTES } from "../shared/files";

const INCOGNITO =
  "Not saved: this chat is incognito and incognito chats keep no files. Tell the user to turn incognito off and ask again.";

const FILE_RULES = {
  create_text_file: `- create_text_file: only when the user asks for a file they will keep or share, like a khutbah draft, a study plan or a table of rulings. Never for an answer that reads fine in chat.`,
  create_research_report: `- create_research_report: in Research, write the full report here, with headings, citing sources with the same [n] numbers as in chat. They become links to the sources in the file. Your chat answer is then a short summary of three to five sentences that says the full report is below. Do not repeat the report in chat.`,
  code_execution: `- code_execution: every file a script writes into the folder in the $OUTPUT_DIR environment variable is saved to the user's Library. When the sandbox computes a table or chart the user wants as a file, have the same script write it (CSV, PNG or PDF) there. When the user asks for a Word document, like a khutbah or a letter, have the script write it as a .docx with python-docx there. Write nothing else into $OUTPUT_DIR. Do not retype sandbox output into create_text_file.`,
  share_files: `- share_files: gives the user files from your files, like a ticket or receipt your browser downloaded or a file your code changed in $FILES_DIR. They are saved to the user's Library and shown under your answer.`,
};

const FILE_RULES_END = `For all of them: write your answer first, then call the tool last, and do not say a file is saved until the tool has returned. The user gets a card with the file under your answer and finds the file in their Library. After the tool returns, add one short sentence at most. If it returns an error, say so plainly and give the content in chat.`;

export const fileRules = (offered: ToolSet) => {
  const rules = Object.entries(FILE_RULES).filter(([name]) => name in offered);
  return {
    tools: rules.map(([name]) => name),
    text: `You can hand the user files:\n${rules.map(([, rule]) => rule).join("\n")}\n${FILE_RULES_END}`,
  };
};

async function keep(by: string, name: string, bytes: Uint8Array) {
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
    throw new Error(`${name} must be between 1 byte and ${formatSize(MAX_FILE_BYTES)}.`);
  }
  const mediaType = mediaTypeOf(bytes);
  if (!mediaType) {
    throw new Error(
      `${name} was not saved: only images, PDFs, Word documents and UTF-8 text can be kept.`,
    );
  }
  return saveFile(by, { name, mediaType, bytes });
}

const savedNote = (files: { name: string }[]) =>
  `Saved to the user's Library: ${files.map((file) => file.name).join(", ")}. A card for it is shown under your answer.`;

export function fileTools({
  owner,
  incognito,
  research,
  sandbox,
  disk,
  link,
}: {
  owner: string;
  incognito: boolean;
  research: boolean;
  sandbox: ReturnType<typeof codeSandbox> | undefined;
  disk?: BotDisk;
  link: (text: string) => string;
}) {
  const keepAll = async (named: { name: string; bytes: Uint8Array }[]) => {
    const results = await Promise.all(
      named.map(({ name, bytes }) =>
        keep(owner, name.trim().slice(-FILE_NAME_MAX) || "file", bytes).then(
          (saved) => ({ kind: "saved", saved }) as const,
          (err: Error) => ({ kind: "failed", error: reasonOf(err) }) as const,
        ),
      ),
    );
    return {
      files: results.flatMap((result) => (result.kind === "saved" ? [result.saved] : [])),
      errors: results.flatMap((result) => (result.kind === "failed" ? [result.error] : [])),
    };
  };
  const saveText = async (name: string, bytes: Uint8Array) => {
    if (incognito) throw new Error(INCOGNITO);
    return { files: [await keep(owner, name, bytes)] };
  };
  return {
    create_text_file: tool({
      description:
        "Saves a text file (markdown, plain text or CSV) to the user's Library and shows it as a download card under your answer.",
      inputSchema: z.object({
        name: fileName.regex(/\.(md|txt|csv)$/iu, "Name it with .md, .txt or .csv."),
        content: z.string().min(1).describe("The whole file."),
      }),
      execute: ({ name, content }) => saveText(name, new TextEncoder().encode(content)),
      toModelOutput: ({ output }) => ({ type: "text", value: savedNote(output.files) }),
    }),
    ...(research && {
      create_research_report: tool({
        description:
          "Saves a long markdown research report to the user's Library and shows it as a report card under your answer.",
        inputSchema: z.object({
          title: z.string().trim().min(1).max(120),
          content: z.string().min(1).describe("The whole report, in markdown."),
        }),
        execute: ({ title, content }) =>
          saveText(
            `${title.replaceAll(/[\\/:*?"<>|]+/gu, "-")}.md`,
            new TextEncoder().encode(link(content)),
          ),
        toModelOutput: ({ output }) => ({ type: "text", value: savedNote(output.files) }),
      }),
    }),
    ...(sandbox && {
      code_execution: tool({
        description:
          "Runs a complete Python 3 script in a sandbox without internet access and returns its stdout, stderr and exit code. Files the script writes to $OUTPUT_DIR are saved to the user's Library and shown as download cards under your answer." +
          (disk
            ? " Your files, like downloads from your browser and files the user sent you, are in $FILES_DIR, and whatever the script changes there is kept."
            : ""),
        inputSchema: z.object({ code: z.string().min(1).describe("The complete Python script.") }),
        execute: async ({ code }, { abortSignal }) => {
          const { files, ...ran } = await sandbox(code, abortSignal);
          if (files.length > 0 && incognito) return { ...ran, files: [], errors: [INCOGNITO] };
          return { ...ran, ...(await keepAll(files)) };
        },
        toModelOutput: ({ output }) => ({
          type: "text",
          value: [
            `Exit code ${output.exitCode}.`,
            output.stdout && `stdout:\n${output.stdout}`,
            output.stderr && `stderr:\n${output.stderr}`,
            output.files.length > 0 && savedNote(output.files),
            output.errors.length > 0 && `Not saved: ${output.errors.join(" ")}`,
            output.kept.length > 0 && `Kept in your files: ${output.kept.join(", ")}.`,
            output.removed.length > 0 && `Removed from your files: ${output.removed.join(", ")}.`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        }),
      }),
    }),
    ...(disk && {
      share_files: tool({
        description:
          "Saves files from your files, like a ticket your browser downloaded or a file your code changed in $FILES_DIR, to the user's Library and shows them as download cards under your answer.",
        inputSchema: z.object({
          files: z
            .array(z.string().trim().min(1))
            .min(1)
            .max(5)
            .describe("Names of your files, like boarding-pass.pdf."),
        }),
        execute: async ({ files }) => {
          if (incognito) throw new Error(INCOGNITO);
          const held = new Set((await disk.list()).map(({ name }) => name));
          const found = files.map(diskName).filter((name) => held.has(name));
          if (found.length === 0) {
            throw new Error(
              `None of those are in your files. Your files: ${[...held].join(", ") || "none"}.`,
            );
          }
          return keepAll(
            await Promise.all(found.map(async (name) => ({ name, bytes: await disk.read(name) }))),
          );
        },
        toModelOutput: ({ output }) => ({
          type: "text",
          value:
            savedNote(output.files) +
            (output.errors.length > 0 ? ` Not saved: ${output.errors.join(" ")}` : ""),
        }),
      }),
    }),
  };
}
