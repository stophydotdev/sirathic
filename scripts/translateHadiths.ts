import Anthropic from "@anthropic-ai/sdk";
import { db } from "@sirathic/db";
import { hadiths, texts } from "@sirathic/db/schema";
import { and, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { z } from "zod";

const PARALLEL_REQUESTS = 4;
const DIR = "data/translations";
const BATCH = `${DIR}/batch.json`;
const RESULTS = `${DIR}/hadiths.json`;
const SYSTEM =
  "Translate this hadith from Arabic into faithful, plain English. Translate every sentence, starting from the Companion who narrates it. Output only the translation. Do not add any note or comment before or after it.";
const CHATTER =
  /^(I cannot|I can.t|I.m sorry|Sorry|Here is|Here.s|I.ll translate|Below is)|\n\s*\*?(Note|Translator)/i;

const client = new Anthropic();

const request = (arabic: string) =>
  ({
    model: "claude-sonnet-5-5",
    max_tokens: 16_000,
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: arabic }],
  }) satisfies Anthropic.MessageCreateParamsNonStreaming;

const translation = (message: Anthropic.Message) =>
  message.stop_reason === "end_turn"
    ? {
        kind: "translated" as const,
        english: message.content
          .flatMap((block) => (block.type === "text" ? [block.text] : []))
          .join("")
          .trim(),
      }
    : { kind: "failed" as const, reason: `stopped: ${message.stop_reason}` };

const untranslated = async ({ sample }: { sample?: number }) => {
  const query = db
    .select({
      id: hadiths.id,
      arabic: hadiths.textAr,
      reference: hadiths.textEn,
    })
    .from(hadiths)
    .where(
      and(
        isNotNull(hadiths.textAr),
        sample === undefined ? undefined : isNotNull(hadiths.textEn),
        notExists(
          db
            .select()
            .from(texts)
            .where(
              and(
                eq(texts.ref, hadiths.id),
                eq(texts.source, "hadeethenc-en"),
                eq(texts.kind, "translation"),
              ),
            ),
        ),
      ),
    )
    .orderBy(sample === undefined ? hadiths.id : sql`random()`);
  const rows = await (sample === undefined ? query : query.limit(sample));
  return rows.flatMap(({ arabic, ...row }) => (arabic ? [{ ...row, arabic }] : []));
};

type Row = Awaited<ReturnType<typeof untranslated>>[number];

const checkSample = async (size: number) => {
  const rows = await untranslated({ sample: size });
  const queue = [...rows];
  const results: (Row & ReturnType<typeof translation>)[] = [];
  const usage = { input: 0, output: 0 };
  const work = async (): Promise<void> => {
    const row = queue.shift();
    if (row === undefined) return;
    const message = await client.messages.create(request(row.arabic));
    usage.input += message.usage.input_tokens;
    usage.output += message.usage.output_tokens;
    results.push({ ...row, ...translation(message) });
    console.log(`${results.length}/${rows.length} ${row.id}`);
    return work();
  };
  await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, work));
  await Bun.write(`${DIR}/sample.json`, JSON.stringify({ usage, results }, null, 1));
  console.log(`tokens in ${usage.input}, out ${usage.output}`);
};

const BATCH_SIZE = 5_000;
const savedBatches = z.array(z.object({ id: z.string(), ids: z.array(z.string()) }));
type SavedBatches = z.infer<typeof savedBatches>;

const submitBatches = async (batches: SavedBatches, rows: Row[]) => {
  const chunk = rows.slice(0, BATCH_SIZE);
  if (chunk.length === 0) return;
  const batch = await client.messages.batches.create({
    requests: chunk.map((row, index) => ({
      custom_id: `h${index}`,
      params: request(row.arabic),
    })),
  });
  batches.push({ id: batch.id, ids: chunk.map((row) => row.id) });
  await Bun.write(BATCH, JSON.stringify(batches));
  console.log(`submitted ${batch.id} with ${chunk.length} hadiths`);
  await submitBatches(batches, rows.slice(BATCH_SIZE));
};

const allEnded = async (batches: SavedBatches): Promise<void> => {
  const states = await Promise.all(batches.map(({ id }) => client.messages.batches.retrieve(id)));
  const total = (key: keyof Anthropic.Messages.MessageBatchRequestCounts) =>
    states.reduce((sum, state) => sum + state.request_counts[key], 0);
  const ended = states.filter((state) => state.processing_status === "ended").length;
  console.log(
    `${ended}/${states.length} batches ended: ${total("succeeded")} succeeded, ${total("processing")} processing, ${total("errored")} errored`,
  );
  if (ended === states.length) return;
  await Bun.sleep(60_000);
  return allEnded(batches);
};

const translateAll = async () => {
  const batches = (await Bun.file(BATCH).exists())
    ? savedBatches.parse(await Bun.file(BATCH).json())
    : [];
  const sent = new Set(batches.flatMap(({ ids }) => ids));
  await submitBatches(
    batches,
    (await untranslated({})).filter((row) => !sent.has(row.id)),
  );
  await allEnded(batches);
  const translated: Record<string, string> = {};
  const failed: Record<string, string> = {};
  const usage = { input: 0, output: 0 };
  await Promise.all(
    batches.map(async ({ id, ids }) => {
      for await (const { custom_id, result } of await client.messages.batches.results(id)) {
        const hadithId = ids[Number(custom_id.slice(1))];
        if (!hadithId) throw new Error(`batch ${id} returned unknown request ${custom_id}`);
        if (result.type !== "succeeded") {
          failed[hadithId] = result.type === "errored" ? result.error.error.type : result.type;
          continue;
        }
        usage.input += result.message.usage.input_tokens;
        usage.output += result.message.usage.output_tokens;
        const outcome = translation(result.message);
        if (outcome.kind === "translated") translated[hadithId] = outcome.english;
        else failed[hadithId] = outcome.reason;
      }
    }),
  );
  await Bun.write(
    RESULTS,
    JSON.stringify({ batches: batches.map(({ id }) => id), usage, translated, failed }, null, 1),
  );
  console.log(
    `translated ${Object.keys(translated).length}, failed ${Object.keys(failed).length}, tokens in ${usage.input}, out ${usage.output}`,
  );
};

const savedResults = z.looseObject({
  translated: z.record(z.string(), z.string()),
  failed: z.record(z.string(), z.string()),
});

const redoChatter = async () => {
  const saved = savedResults.parse(await Bun.file(RESULTS).json());
  const noisy = Object.entries(saved.translated)
    .filter(([, english]) => CHATTER.test(english))
    .map(([id]) => id);
  const queue = (
    await db
      .select({ id: hadiths.id, arabic: hadiths.textAr })
      .from(hadiths)
      .where(inArray(hadiths.id, noisy))
  ).flatMap(({ id, arabic }) => (arabic ? [{ id, arabic }] : []));
  const work = async (): Promise<void> => {
    const row = queue.shift();
    if (row === undefined) return;
    const outcome = translation(await client.messages.create(request(row.arabic)));
    if (outcome.kind === "translated") saved.translated[row.id] = outcome.english;
    else saved.failed[row.id] = outcome.reason;
    return work();
  };
  await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, work));
  await Bun.write(RESULTS, JSON.stringify(saved, null, 1));
  console.log(
    `redid ${noisy.length}, still with chatter ${Object.values(saved.translated).filter((english) => CHATTER.test(english)).length}`,
  );
};

await mkdir(DIR, { recursive: true });
const [flag, size] = process.argv.slice(2);
if (flag === "--sample") await checkSample(z.coerce.number().int().positive().parse(size));
else if (flag === "--redo") await redoChatter();
else if (flag !== undefined)
  throw new Error(
    "Usage: bun run translate --sample <count> to check quality on hadiths that also have sunnah.com English, bun run translate to send all of them as Message Batches of 5,000 (rerunning resumes the saved batches), or bun run translate --redo to translate again the saved ones that carry notes or a reply",
  );
else await translateAll();
await db.$client.end();
