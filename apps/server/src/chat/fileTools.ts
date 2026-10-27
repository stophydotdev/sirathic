import { env } from "@sirathic/env/server";
import { type StreamTextTransform, type TextStreamPart, tool, type ToolSet } from "ai";
import { z } from "zod";
import { reasonOf } from "../http";
import { mediaTypeOf } from "../files/sniff";
import { fileName, saveFile } from "../files/store";
import { FILE_NAME_MAX, formatSize, MAX_FILE_BYTES } from "../shared/files";

const FILES_API = "https://api.anthropic.com/v1/files";

const INCOGNITO =
  "Not saved: this chat is incognito and incognito chats keep no files. Tell the user to turn incognito off and ask again.";

const FILE_RULES = {
  create_text_file: `- create_text_file: only when the user asks for a file they will keep or share, like a khutbah draft, a study plan or a table of rulings. Markdown (.md), plain text (.txt) or CSV (.csv). Never for an answer that reads fine in chat.`,
  create_research_report: `- create_research_report: in Research, write the full report here, with headings and a Sources list that links each source by its URL (the [n] numbers do not work in a file). Your chat answer is then a short summary of three to five sentences that says the full report is below. Do not repeat the report in chat.`,
  share_files: `- share_files: gives the user files code_execution wrote. When the sandbox computes a table or chart the user wants as a file, have the same script write it (CSV, PNG or PDF) into the folder in the $OUTPUT_DIR environment variable, in that same call, then call share_files with the file names, like zakat.csv. You never see file ids and do not need them. Do not retype sandbox output into create_text_file. Only images, PDFs and UTF-8 text files can be kept.`,
};

const FILE_RULES_END = `For all of them: write your answer first, then call the tool last, and do not say a file is saved until the tool has returned. The user gets a card with the file under your answer and finds the file in their Library. After the tool returns, add one short sentence at most. If it returns an error, say so plainly and give the content in chat.`;

export const fileRules = (offered: ToolSet) => {
  const rules = Object.entries(FILE_RULES)
    .filter(([name]) => name in offered)
    .map(([, rule]) => rule);
  return rules.length > 0
    ? `\n\nYou can hand the user files:\n${rules.join("\n")}\n${FILE_RULES_END}`
    : "";
};

const sandboxFile = z.object({ filename: z.string(), size_bytes: z.number() });

const sandboxResult = z.object({ content: z.array(z.object({ file_id: z.string() })) });

export function sandboxFiles() {
  let ids: string[] = [];
  const reached = new Map<string, ReturnType<typeof Promise.withResolvers<void>>>();
  const gate = (callId: string) => {
    const known = reached.get(callId) ?? Promise.withResolvers<void>();
    reached.set(callId, known);
    return known;
  };
  const transform = <TOOLS extends ToolSet>(): StreamTextTransform<TOOLS> => {
    return () =>
      new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
        transform(part, controller) {
          if (part.type === "tool-result" && part.toolName === "code_execution") {
            const output = sandboxResult.safeParse(part.output).data;
            ids.push(...(output?.content.map((file) => file.file_id) ?? []));
          }
          if (part.type === "tool-call") gate(part.toolCallId).resolve();
          controller.enqueue(part);
        },
      });
  };
  const take = async (callId: string) => {
    await gate(callId).promise;
    const taken = ids;
    ids = [];
    return taken;
  };
  return { take, transform };
}

const sandboxGet = async (url: string, signal: AbortSignal | undefined) => {
  const response = await fetch(url, {
    signal,
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "files-api-2025-04-14",
    },
  });
  if (!response.ok) throw new Error(`The sandbox file could not be read (${response.status}).`);
  return response;
};

const sandboxMeta = async (id: string, signal: AbortSignal | undefined) =>
  sandboxFile.parse(await (await sandboxGet(`${FILES_API}/${id}`, signal)).json());

async function sandboxBytes(id: string, signal: AbortSignal | undefined) {
  const content = await sandboxGet(`${FILES_API}/${id}/content`, signal);
  return new Uint8Array(await content.arrayBuffer());
}

async function keep(by: string, name: string, bytes: Uint8Array) {
  if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) {
    throw new Error(`${name} must be between 1 byte and ${formatSize(MAX_FILE_BYTES)}.`);
  }
  const mediaType = mediaTypeOf(bytes);
  if (!mediaType) {
    throw new Error(`${name} was not saved: only images, PDFs and UTF-8 text can be kept.`);
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
}: {
  owner: string;
  incognito: boolean;
  research: boolean;
  sandbox: ReturnType<typeof sandboxFiles> | undefined;
}) {
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
            new TextEncoder().encode(content),
          ),
        toModelOutput: ({ output }) => ({ type: "text", value: savedNote(output.files) }),
      }),
    }),
    ...(sandbox && {
      share_files: tool({
        description:
          "Saves files that code_execution wrote to $OUTPUT_DIR to the user's Library and shows them as download cards under your answer.",
        inputSchema: z.object({
          files: z
            .array(z.string().trim().min(1))
            .min(1)
            .max(5)
            .describe("The names of the files code_execution wrote, like zakat.csv."),
        }),
        execute: async ({ files }, { abortSignal, toolCallId }) => {
          if (incognito) throw new Error(INCOGNITO);
          const found = await Promise.all(
            (await sandbox.take(toolCallId)).map(async (id) => {
              const meta = await sandboxMeta(id, abortSignal);
              return { id, filename: meta.filename, size_bytes: meta.size_bytes };
            }),
          );
          const newest = found.filter(
            (file, index) =>
              found.findLastIndex((other) => other.filename === file.filename) === index,
          );
          const wanted = new Set(files.map((name) => name.toLowerCase()));
          const results = await Promise.all(
            newest
              .filter((file) => wanted.has(file.filename.toLowerCase()))
              .map((file) =>
                (file.size_bytes > MAX_FILE_BYTES
                  ? Promise.reject(
                      new Error(
                        `${file.filename} is over ${formatSize(MAX_FILE_BYTES)}, so it was not saved.`,
                      ),
                    )
                  : sandboxBytes(file.id, abortSignal)
                )
                  .then((bytes) =>
                    keep(owner, file.filename.trim().slice(-FILE_NAME_MAX) || "file", bytes),
                  )
                  .then(
                    (saved) => ({ kind: "saved", saved }) as const,
                    (err: Error) => ({ kind: "failed", error: reasonOf(err) }) as const,
                  ),
              ),
          );
          const kept = results.flatMap((result) => (result.kind === "saved" ? [result.saved] : []));
          const errors = results.flatMap((result) =>
            result.kind === "failed" ? [result.error] : [],
          );
          if (kept.length === 0) {
            const names = found.map((file) => file.filename).join(", ") || "none";
            throw new Error(
              `No matching file was saved. Files the sandbox wrote to $OUTPUT_DIR: ${names}. ${errors.join(" ")}`.trim(),
            );
          }
          return { files: kept, errors };
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
