# Realtime over one WebSocket

Each signed-in tab or phone opens one WebSocket to the API. The server uses it to say what
changed, and the client refetches that thing with the tRPC query it uses now. Chat text
keeps streaming over HTTP. Every poll stays in the code as the fallback and runs only
while the socket is down.

Status: design only. No code until Hussein and the orchestrator approve it.

## 1. What polls today

The brief counted about 49 timers. On `main` (d3deb0f) there are 18. Four are local
clocks and animations. Two are device sign-in loops. Twelve poll the server for state a
socket could push.

### Polls a socket replaces

| #   | App    | Code                                 | Fetches                                | Every                     | When and where                                             |
| --- | ------ | ------------------------------------ | -------------------------------------- | ------------------------- | ---------------------------------------------------------- |
| 1   | web    | `components/automationAlerts.tsx:78` | `automations.runs`                     | 30 s, and on window focus | Every signed-in tab, any screen (mounted in `threadShell`) |
| 2   | web    | `components/automations.tsx:236`     | `automations.list`, `automations.runs` | 30 s                      | Automations page                                           |
| 3   | web    | `components/botNav.tsx:139`          | `sessions.list`                        | 10 s                      | Sidebar bot list, while any chat is working                |
| 4   | web    | `components/chat.tsx:408`            | `sessions.list`, `sessions.get`        | 4 s                       | Open bot chat, while it answers in the background          |
| 5   | web    | `components/chat.tsx:417`            | `sessions.get` (peek)                  | 3 s                       | Open bot chat, tab visible, user has 2+ bots               |
| 6   | web    | `components/tasks.tsx:158`           | `tasks.list`                           | 4 s                       | Tasks page, while a task runs                              |
| 7   | mobile | `app/automations.tsx:170`            | `automations.list`, `automations.runs` | 30 s                      | Automations screen                                         |
| 8   | mobile | `app/tasks.tsx:133`                  | `tasks.list`                           | 4 s                       | Tasks screen, while a task runs                            |
| 9   | mobile | `components/bot-list.tsx:159`        | `sessions.list`                        | 10 s                      | Drawer bot list, while any chat is working                 |
| 10  | mobile | `components/bot-chat.tsx:128`        | `sessions.get`                         | 4 s                       | Open bot chat, user has 2+ bots                            |
| 11  | mobile | `components/bot-chat.tsx:157`        | `sessions.list`, `sessions.get`        | 4 s                       | Open bot chat, while it answers in the background          |
| 12  | mobile | `components/group-chat.tsx:36`       | `sessions.get`                         | 3 s                       | Open group chat, always                                    |

Desktop has no timers of its own. It is a shell around sirathic.com, so it runs the web
polls.

### Polls that stay

- `web components/planConnect.tsx:135` (`plans.poll`) and `mobile components/sign-in.tsx:143`
  (`/api/auth/chatgpt/poll`). These are OAuth device-code loops against a third party, at
  the interval it sets. They last one sign-in.

### Not polls

`web composer.tsx:90` (placeholder rotation), `web researchSteps.tsx:38` and
`mobile answer.tsx:163` (elapsed-time clocks), `mobile dictation.tsx:63` (mic level).

### What production sends

Source: Railway request counts for the `sirathic` API service, production, filtered by
path, for the 7 days ending 2026-11-02 21:00 UTC. tRPC batches calls, so one path is one
combination of calls.

| Path                                                       | Requests in 7 days | Per minute | Polls                     |
| ---------------------------------------------------------- | -----------------: | ---------: | ------------------------- |
| `/trpc/automations.runs`                                   |             10,201 |       1.01 | 1                         |
| `/trpc/automations.list,automations.runs,automations.runs` |                948 |       0.09 | 1 + 2, batched            |
| `/trpc/automations.list,automations.runs`                  |                 13 |       0.00 | 7                         |
| `/trpc/sessions.list`                                      |              1,497 |       0.15 | 3, 9, and page loads      |
| `/trpc/sessions.get`                                       |              1,369 |       0.14 | 5, 10, 12, and chat opens |
| `/trpc/sessions.list,sessions.get`                         |                495 |       0.05 | 4, 11                     |
| `/trpc/tasks.list`                                         |                  0 |          0 | 6, 8                      |
| Poll paths together                                        |             14,523 |       1.44 |                           |
| All API requests                                           |             22,971 |       2.28 |                           |

Polls are 63% of all API traffic. Poll 1 alone is 44%, because every signed-in tab runs
it on every screen. The busiest 6-hour window was 3,148 requests, about 8.7 a minute.

The two `sessions` rows also count normal page loads, so they are upper bounds.

The HTTP logs reach back to the last deploy only (16:38 UTC). In those 4.4 hours, all
poll traffic came from two desktop browsers. One Windows tab left on the Automations page
sent 263 of the 613 requests.

What this means: polling costs us little load at today's size. What a socket buys is
speed (a routine alert shows in under a second, not up to 30 seconds) and a cost that
grows with changes instead of with open tabs.

## 2. The socket

### Connecting

The live browser view already does this (`bots/browserRoutes.ts`, `bots/ticket.ts`),
so we copy it.

1. The client calls `POST /api/realtime/ticket` with its normal session: the cookie
   through the web rewrite, or `sessionHeaders()` on mobile. The server checks it with
   better-auth and returns a 60-second ticket signed over the user id and session id.
2. The client opens `wss://api.sirathic.com/api/realtime?ticket=…&after=<cursor>`
   straight to `NEXT_PUBLIC_SERVER`, as `browserView.tsx` does.
3. A bad or expired ticket closes the socket with 4401, and the client fetches a new one.

Signing out deletes the session. The existing `databaseHooks.session.delete` hook in
`account/auth.ts` publishes `{ kind: "signedOut", sessionId }`, and the server closes
that session's sockets.

One socket per tab on web and desktop, and one per app on the phone. Sharing a socket
between tabs is not worth the code at our size.

### Events

The server only sends. Each event has a `kind`, an `id` (the resume cursor) and ids, not
content. The client refetches with the query it already uses, so auth and data shapes
stay in the tRPC routers, and an event can never leak text.

| Event                                                        | Sent from                                                                                         | Client refetches                                 | Replaces polls       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------- |
| `{ kind: "message", chatId }`                                | `chat/sessions.ts` `saveSession`, `appendMessages`                                                | `sessions.get` for an open chat, `sessions.list` | 5, 10, 12            |
| `{ kind: "answering", chatId, answering }`                   | `chat/answers.ts` `startAnswer` and its end                                                       | `sessions.list`, group typing dot                | 3, 4, 9, 11          |
| `{ kind: "approval", chatId, state: "needed" \| "decided" }` | `saveSession`, `appendMessages`, from a part's `approval-requested` or `approval-responded` state | `sessions.list`, the open chat                   | part of 3, 9         |
| `{ kind: "task", taskId, state }`                            | `bots/taskBook.ts` task start and `endTask`                                                       | `tasks.list`                                     | 6, 8                 |
| `{ kind: "bot", botId }`                                     | bot create, update and delete routes                                                              | `projects.list`                                  | none, saves a reload |
| `{ kind: "run", automationId, chatId }`                      | `automations/runner.ts` when a run saves its chat                                                 | `automations.runs`, web notification             | 1, 2, 7              |
| `{ kind: "reset" }`                                          | server, when it cannot replay                                                                     | everything on screen                             |                      |

When another device starts an answer, `answering: true` tells this device to attach to
the existing HTTP resume stream (`GET /api/chat/:id/stream`) and watch it live.

### Resume

The cursor is the event id. On connect with `after`, the server sends every event the
user got after it, then live events. If the cursor is older than what the server kept,
or unknown, it sends `reset` and the client refetches the screen.

Events are kept per user for 24 hours, up to the last 200. A phone that was offline for a
day gets a `reset`, and that costs one batched query it makes on launch anyway.

## 3. Fan-out: Redis

We use the Railway Redis we already run. Each event is two commands:

- `XADD rt:<userId> MAXLEN ~ 200 * event <json>` stores it and returns the id. The key
  expires 24 hours after the last event.
- `PUBLISH rt <userId + event>` sends it live. Each API process keeps one subscriber
  connection (Bun's `RedisClient.subscribe` needs its own connection) and hands each
  event to that user's sockets.

On connect the server registers the socket first, then reads `XRANGE rt:<userId> (after +`,
sends that, and drops any live event with an id it already sent.

Why Redis:

- It is already deployed, `REDIS_URL` is already required, and Bun 1.4 has a native
  client with publish and subscribe (`packages/core/src/cache.ts` uses it). No new service
  and no new dependency.
- The cursor has to outlive a deploy. Production deployed 40 times on 2026-11-01 and 43
  times on 2026-11-02. If events lived in process memory, every deploy would send every
  device a `reset`.
- Postgres LISTEN/NOTIFY does not fit Neon. The pooled endpoint is PgBouncer in
  transaction mode, which does not keep LISTEN. A direct connection held open for LISTEN
  would stop the compute from ever suspending, which is the cost problem we fixed on
  2026-10-30. NOTIFY also has no replay, so the cursor would need a table anyway.

Limit: Redis pub/sub drops messages while a subscriber is disconnected, and Bun's client
reconnects without its subscriptions. So every 5 seconds each process publishes a beat on
`rt` and checks it heard the last one. If not, it subscribes again and sends `reset` to
all of its sockets. If Redis is down, it closes its sockets and the clients poll.

The API runs one replica today (`numReplicas: 1`). `chat/answers.ts` keeps running
answers in a process `Map`, so it can't run two yet anyway. This design works with
more than one and doesn't change that.

## 4. Mobile in the background

When `AppState` goes to `background`, the app closes the socket. When it comes back to
`active`, it reconnects with its cursor and catches up. iOS suspends the JavaScript a few
seconds after backgrounding and Android Doze cuts the network, so a background socket
would die anyway.

There are no push notifications today. There is no `expo-notifications`, and iOS push
needs a paid Apple Developer membership, while we build with a free Apple ID. Background
alerts are a separate decision and not part of this design.

Battery: the socket lives only in the foreground, while the screen is on. Today an open
bot or group chat polls every 3 to 4 seconds, so the cellular radio never rests. With a
socket the radio wakes for real events and the keepalive ping every 30 seconds. That
should cost less battery than today. We'll check it in Android's battery stats on the
emulator before rollout.

Keepalive: `api.sirathic.com` is behind Cloudflare, which closes a WebSocket that stays
quiet for 100 seconds. The server sends a ping every 30 seconds. Bun pings idle sockets
on its own (`sendPings`), but we have not checked its timing through Cloudflare, so the
dev test checks a quiet socket survives 5 minutes.

## 5. Chat text stays on HTTP

We keep it. The AI SDK `useChat` stream works today, with resume (`GET /api/chat/:id/stream`)
and keepalive pings (`chat/keepAlive.ts`), on web and mobile. Moving it would rewrite the
answer path for no measured gain. The socket only adds the `answering` event so other
devices know a stream exists and can attach to it.

## 6. Rollout

### Flag

`account.status` returns `live: boolean`. The server sets it from `REALTIME_USERS`, a
comma list of user ids or `*`, empty by default like `REVIEWERS`. While a user is not in
it, nothing for them is written to Redis and the ticket route answers 404. Changing it
is a Railway variable change, which redeploys the API.

### Fallback

Each poll in the table gets one condition: it runs only while the socket is not open.
When the socket drops, the client reconnects after 1, 2, 4 … up to 30 seconds with jitter,
and the polls run until it is back. On a deploy the old process closes its sockets with
code 1012 at SIGTERM (`index.ts:91`), so clients move to the new process right away.

### Steps

1. Server: ticket route, socket route, publishing at the points in the event table. No
   client opens a socket. Check on dev that events land in Redis.
2. Flag on for Hussein on dev, web and phone. Then on production.
3. Flag on for everyone.
4. Two weeks with no fallback minutes we can't explain, then decide whether the poll
   code goes.

### Numbers we check

| Number                                                             | Today                                                                                                            | Target                       | How                                                                                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Poll-path requests a minute                                        | 1.44 (`automations.runs` alone 1.01)                                                                             | under 0.15                   | The same Railway path counts as section 1                                                                                                                        |
| Event to screen, p50 / p95                                         | Half the poll interval plus the request: 15 s for routine alerts, 5 s for the bot list, 1.5 to 2 s in a bot chat | under 1 s / 2 s              | The client sends `{ kind: "seen", id }` after it renders. The server writes the gap from publish to `seen` to the `events` table, both times on the server clock |
| Sockets open, reconnects an hour, resets sent, minutes on fallback | none                                                                                                             | reconnects mostly at deploys | Server log line per connect and close, and `events` rows                                                                                                         |

## What this touches in production

- API service `sirathic`: two new routes and publish calls inside existing writes.
- Redis service: new `rt:<userId>` stream keys (24-hour expiry, 200 events each) and an
  `rt` channel. Small, and Redis already holds the cache.
- Neon: new rows in the existing `events` table with a new `name`. No schema change.
- Web on Cloudflare Workers and the phone app: client changes. The phone needs a new
  build.
- One new env key with an empty default, `REALTIME_USERS`. No new services or
  dependencies.

## Left out on purpose

- Push notifications for the phone in the background (needs the paid Apple account).
- Sharing one socket between web tabs.
- Event payloads with content.
- Moving the chat stream to the socket.
