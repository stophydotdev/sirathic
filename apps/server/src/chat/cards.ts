import { getToolName, isToolUIPart, tool } from "ai";
import { z } from "zod";
import {
  mergeTodos,
  place,
  places,
  product,
  products,
  quiz,
  steps,
  todoList,
  todoWrite,
  translation,
} from "../shared/cards";
import type { ChatMessage } from "../shared/messages";

const shown = async () => ({ shown: true });

const json = z.json();
const searched = z.object({ results: z.array(json) });
const stophyOutput = z.object({ data: json });
const shopOutput = z.object({ products: z.array(json) });

export const cardBook = (history: readonly ChatMessage[]) => {
  const known = new Map<string, z.infer<typeof place>>();
  const goods = new Map<string, z.infer<typeof product>>();
  const add = (data: z.infer<typeof json>) => {
    for (const row of searched.safeParse(data).data?.results ?? []) {
      const found = place.safeParse(row).data;
      if (found) known.set(found.placeId, found);
    }
  };
  const addProducts = (rows: readonly z.infer<typeof json>[]) => {
    for (const row of rows) {
      const found = product.safeParse(row).data;
      if (found) goods.set(found.id, found);
    }
  };
  for (const part of history.flatMap((message) => message.parts)) {
    if (!isToolUIPart(part) || part.state !== "output-available") continue;
    if (getToolName(part) === "stophy_call") {
      const output = stophyOutput.safeParse(part.output).data;
      if (output) add(output.data);
    }
    if (getToolName(part) === "shop_search") {
      addProducts(shopOutput.safeParse(part.output).data?.products ?? []);
    }
  }
  return { add, known, addProducts, goods };
};

export const todoBook = (history: readonly ChatMessage[]) => {
  const lists = history
    .flatMap((message) => message.parts)
    .flatMap((part) =>
      isToolUIPart(part) && getToolName(part) === "todo_write" && part.state === "output-available"
        ? [todoList.safeParse(part.output).data?.todos ?? []]
        : [],
    );
  let current = lists.at(-1) ?? [];
  return {
    write: (input: z.infer<typeof todoWrite>) => {
      current = mergeTodos(current, input);
      return { todos: current };
    },
  };
};

export const answerCards = (
  book: ReturnType<typeof cardBook>,
  todos: ReturnType<typeof todoBook>,
) => ({
  show_steps: tool({
    description: `Show a numbered, step-by-step walkthrough of a procedure. Use this for how-to questions where the answer is 3 to 8 ordered steps, each with a short title and a one- or two-sentence description, like 'how do I perform wudu', 'how is the janazah prayer done' or 'how do I pay zakat al-fitr'.

DON'T use this card when:
- The answer is a single step: write prose.
- The answer is a ruling, background explanation, or a list of options to choose between: write prose.
- Steps don't have a meaningful order, or you'd be inventing filler steps to reach three.

Keep each step title to a few imperative words; each step's description can be a short paragraph, enough detail to actually do the step without guessing. Base the steps on the sources you found and cite them in your prose. The card already numbers and renders the steps: don't re-list them in your prose, and don't prefix titles with 'Step 1:'.`,
    inputSchema: steps,
    execute: shown,
  }),
  show_quiz: tool({
    description: `Generate an interactive multiple-choice quiz rendered as a card in the chat; the same questions can also be flipped through as flashcards (question on the front, correct answer and explanation on the back). Use this when the user asks for a quiz, practice questions, self-assessment, or to test their knowledge on a topic, including from documents, videos or notes they've shared. Each question needs plausible distractors (wrong answers that seem reasonable), a clear explanation of why the correct answer is right, and optionally a hint. Keep explanations concise and educational. Default to 5 questions unless the user asks for a specific count.

Fetch the verses, hadith and rulings you ask about before you write the card, and never write one from memory. Never quiz on a hadith a source grades weak or fabricated. The card shows the questions and answers, so don't repeat them in your prose.`,
    inputSchema: quiz,
    execute: shown,
  }),
  show_translation: tool({
    description:
      "Show a translation card when the user asks how to say, write or translate a specific short passage (a message, sentence, phrase, dua or a few lines) into another language. The card shows the original and the translation side by side with a copy button, so do NOT repeat the translation in your reply: after the card, add one or two sentences of nuance only (register or politeness choice, a regional note, or what to change for a different tone). Do not use it for single-word dictionary lookups, for translating long documents or files, for the meaning of a verse or hadith, which you quote with its source, or when the user wants an explanation of grammar rather than a rendering.",
    inputSchema: translation,
    execute: shown,
  }),
  todo_write: tool({
    description: `Your task list: the durable list of everything the user has asked for in this chat. The user sees it as a checklist, and the full merged list comes back as the result.

When to use:
- The moment a request with two or more parts arrives, record it as todos before you start it.
- Update statuses in real time: in_progress when its work starts, completed the moment its result is delivered to the user, cancelled when the user drops it or changes their mind.
- On every user message, reconcile the list first: what's running, what landed, what's next.

States and parallelism:
- pending: not yet started. in_progress: actively being worked. completed: result delivered to the user. cancelled: no longer needed.
- SEVERAL todos are normally in_progress at once, one per independent stream running in parallel, plus at most one thing you are doing inline. Never serialize independent streams just to keep a single one in_progress.
- Keep the list current rather than perfect: cancel stale items instead of leaving them pending, and prune long-finished ones when the list gets noisy.

Skip it for purely conversational replies and trivial one-step lookups you answer inline immediately.`,
    inputSchema: todoWrite,
    execute: async (input) => todos.write(input),
  }),
  show_places: tool({
    description: `Show a stacked list of places, each with its photo, rating, open status and a Google Maps link. Whenever your answer recommends 2 to 8 specific places you found with google.maps.search, like masjids near the user, halal restaurants or hotels near the Haram, call this before you write your answer, then write your picks after the card.

Pass each place's placeId and a description: the card fills in the name, address, rating and photo from the search result, so don't include them. Each place's description can be a sentence or two: what it's like, what to know before going.

DON'T use this card when you only have one place: write prose. Don't re-list the places in your prose.`,
    inputSchema: places,
    execute: async ({ places: chosen }) => {
      const missing = chosen.filter(({ placeId }) => !book.known.has(placeId));
      const found = chosen.flatMap(({ placeId, ...notes }) => {
        const known = book.known.get(placeId);
        return known ? [{ ...known, ...notes }] : [];
      });
      if (found.length === 0) {
        throw new Error(
          "No google.maps.search result in this chat has these placeIds. Search with stophy_call first and copy each placeId exactly.",
        );
      }
      return { places: found, missing: missing.map(({ placeId }) => placeId) };
    },
    toModelOutput: ({ output }) => ({
      type: "json",
      value: { shown: output.places.length, missing: output.missing },
    }),
  }),
  show_products: tool({
    description: `Show a row of product cards, each with its photo, price, rating, store and a link to the product's own page. When your answer recommends products you found with shop_search, show them in this card instead of a text list: every shortlist, and a single product the user asked about or picked. Write your text first, without listing them: your pick and the main tradeoff, and anything to know before ordering. Then call this last, so the card and its follow-ups end your answer.

Pass each product's id and a short note: the card fills in the name, photo, price, rating and store from the search result, so don't include them. Don't re-list the products in your prose.`,
    inputSchema: products,
    execute: async ({ products: chosen, followUps }) => {
      const missing = chosen.filter(({ id }) => !book.goods.has(id));
      const found = chosen.flatMap(({ id, note }) => {
        const known = book.goods.get(id);
        return known ? [{ ...known, note }] : [];
      });
      if (found.length === 0) {
        throw new Error(
          "No shop_search result in this chat has these ids. Search with shop_search first and copy each id exactly.",
        );
      }
      return { products: found, followUps, missing: missing.map(({ id }) => id) };
    },
    toModelOutput: ({ output }) => ({
      type: "json",
      value: { shown: output.products.length, missing: output.missing },
    }),
  }),
});
