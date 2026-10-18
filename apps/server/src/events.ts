import { db } from "@sirathic/db";
import { events } from "@sirathic/db/schema";
import { env } from "@sirathic/env/server";
import type { FinishReason, UIMessageStreamOutcome } from "ai";
import type { z } from "zod";
import type { Client } from "./client";
import { reasonOf } from "./respond";
import type { Device, feedback, Mode } from "./shared/messages";

type AnswerStats = {
  outcome: UIMessageStreamOutcome["status"];
  finishReason?: FinishReason;
  httpStatus?: number;
  totalMs: number;
  firstTextMs?: number;
  toolCalls: number;
  failedTools: number;
  cited: number;
  words: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
};

export type Event =
  | {
      name: "answer.requested";
      props: {
        mode: Mode;
        model: string;
        turn: number;
        regenerate: boolean;
        incognito: boolean;
        files: number;
        device?: Device;
        language?: string;
      } & Client;
    }
  | {
      name: "answer.completed";
      props: AnswerStats & { mode: Mode; model: string };
    }
  | {
      name: "tool.completed";
      props: { tool: string; ms: number; ok: boolean };
    }
  | {
      name: "signin";
      props:
        | ({ step: "started" } & Client)
        | { step: "expired" }
        | { step: "completed"; plan: string | null };
    }
  | {
      name: "feedback.given";
      props: { value: z.infer<typeof feedback> | null };
    }
  | {
      name: "library.read";
      props:
        | { kind: "quran"; surah: number }
        | { kind: "hadith"; collection: string; book: number };
    }
  | { name: "quran.audio"; props: { recitation: number; surah: number } }
  | { name: "api.failed"; props: { route: string; code: string } };

export function track({ name, props }: Event, owner?: string) {
  void db
    .insert(events)
    .values({
      id: Bun.randomUUIDv7(),
      name,
      owner,
      environment: env.RAILWAY_ENVIRONMENT_NAME,
      version: env.RAILWAY_GIT_COMMIT_SHA.slice(0, 7),
      props,
    })
    .catch((err: Error) => {
      console.error(`event not saved: ${reasonOf(err)}`);
    });
}
