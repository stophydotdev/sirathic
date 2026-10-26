# Sirathic

Islamic answering engine. You ask a question, and Sirathic answers from the Quran, hadith,
fiqh books and fatwas, and cites every source.

## A note from Hussein

I like building complex things as simply as possible. Do not keep complexity because it
exists, and do not add machinery because it looks impressive. Find the real constraint
and ship the smallest change that makes the right behavior obvious. Measure twice, cut
once, and fight scope creep.

## Getting started

1. Install [Bun](https://bun.sh).
2. Run `bun install`. It also turns on a git hook that checks each commit.
3. Put the keys listed in `packages/env/src/server.ts` in `apps/server/.env.local`, and
   `NEXT_PUBLIC_SERVER=http://127.0.0.1:3000` in `apps/web/.env.local`.
4. Run `bun dev`. The API starts on port 3000 and the website on port 3001.

Use your own database and keys. Never point a local setup at production.

## Where things live

- `apps/web`: the website (Next.js)
- `apps/server`: the API that answers questions (Hono)
- `apps/mobile` and `apps/desktop`: the phone and desktop apps
- `packages/core`: search and the tools the model uses
- `packages/db`: the database schema
- `scripts`: the fatwa crawler and small tools

## Rules

- No comments in code. Pick names that explain it.
- File names are camelCase in the website, the server, packages and scripts.
- Keep each file under 5,000 tokens, about 20 KB. The commit hook stops bigger files:
  split them by what each part does.
- Text people see in the app goes in `apps/web/src/messages/en.ts` and in the 30 other
  languages next to it.
- No em dashes anywhere, and no competitor names in code, commits or the app.

## TypeScript

- No `any`, and no `unknown` handed from function to function. Parse outside data (request
  bodies, JSON columns, model output, browser storage) with a zod schema where it comes in,
  then use the parsed type.
- Take types from one source: `z.infer` of the schema, `ReturnType` or `Awaited` of the
  function, `typeof` of the constant. Never write the same shape twice.
- No `as` casts except `as const`. Use `satisfies` to check a value without widening it.
- No `!` to skip an undefined check, and no `typeof` checks on data. Give the value a schema.
- Give a value that comes in kinds a `kind` field, like `{ kind: "daily", time }`, and
  switch on it.
- No helper that only renames, wraps or casts another call.

## Before you send a change

Run these. CI runs them on every push too.

- `bun run check`: lint and formatting. It fixes the formatting for you.
- `bun run check-slop`: stricter lint rules.
- `bun run check-types`: TypeScript.
- `bun run check-dead`: unused files, exports and packages.
- `bun run test`: the tests.

Then try your change in the app, in a phone-sized window (390px wide) and a laptop window,
signed in and signed out.

## Commits

One change per commit. Stage only the files that change needs and leave other work in the
tree.

The title is `type(scope): what is true after it`, in plain words, under about 70
characters. The type is `feat`, `fix`, `refactor`, `chore`, `docs`, `test` or `revert`. The
scope is the part it touches: `web`, `server`, `mobile`, `desktop`, `core`, `db` or
`scripts`.

    fix(web): long chat titles scroll on hover

    not: fix: update title overflow CSS

A small commit has no body. Otherwise write one or two short paragraphs: what was wrong or
missing, then what happens now. A refactor ends with "No behavior change." Wrap at 72
characters. An agent ends the message with `Built by <model> in <harness>`, and no
co-author line:

    feat(web): a thumbs-down can carry a reason

    A thumbs-down saved only the vote, so a wrong hadith grade looked the
    same as a slow answer. It now asks what was wrong, with five reasons and
    a details box, and saves the answer on the message.

    Built by <model> in <harness>

## Getting a review

Every change goes through a review on GitHub. Run the checks above, rebase on the latest
`main`, run them again and push once. Open the review ready to read, not as a draft.

The title follows the commit rule: what is true after the change, not what you did.

    feat(web): answers show research steps live and keep running across chats

    not: feat: live steps, background chats, shortcuts and mistake reports

Fit the body to the change. Never fill in a form.

- A small change gets short paragraphs and no headings: what was wrong, what happens now
  and what it costs, then the test that proves it.
- A larger change uses only the headings it needs, from Problem, Fix, Evidence,
  Verification and Out of scope. A feature opens with what a person can do now. A refactor
  says what moved and that behavior did not change.
- A change you can see gets screenshots at 390px and laptop width, before and after, under
  Evidence. With none, say so.
- Verification names each command and what it showed. Never "tested" alone.
- Answer what a reviewer would ask: where it comes from ("Follow-up to #6"), what it
  costs, what you left out on purpose and why, and what you did not check.

An agent ends the body with `Built by <model> in <harness>`.

    fix(server): long answers keep streaming behind the proxy

    Answers that thought for a long time were cut off, because the proxy
    closes a stream that stays quiet. The stream now sends a small ping every
    15 seconds while Noor thinks.

    Tests: a quiet stream gets a ping (apps/server/test/chat/keepAlive.test.ts).

    Built by <model> in <harness>
