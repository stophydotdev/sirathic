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
- No `as` type casts. Check outside data with zod where it comes in.
- File names are camelCase in the website, the server, packages and scripts.
- Keep each file under 5,000 tokens, about 20 KB. The commit hook stops bigger files:
  split them by what each part does.
- Text people see in the app goes in `apps/web/src/messages/en.ts` and in the 30 other
  languages next to it.
- No em dashes anywhere, and no competitor names in code, commits or the app.

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

One change per commit, in [Conventional Commits](https://www.conventionalcommits.org)
and plain words, saying what is true after it: `fix(web): long chat titles scroll on
hover`. Push your branch and ask for a review on GitHub. Nothing reaches `main` without
one, and merging into `main` deploys Sirathic.
