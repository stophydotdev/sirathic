import { db } from "@sirathic/db";
import { events } from "@sirathic/db/schema";
import type { FinishReason, UIMessageStreamOutcome } from "ai";
import type { z } from "zod";
import type { Client } from "./client";
import { reasonOf } from "../http";
import type { Device, feedback, Mode, reportReason } from "../shared/messages";
import type { User } from "../account/users";

type SignInVia = User["via"];

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
  cacheWriteTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
};

export type ToolFailure = "blocked" | "no-text" | "timeout" | "not-found" | "other";

export const toolFailure = (errorText: string): ToolFailure =>
  /can't be read/u.test(errorText)
    ? "blocked"
    : /no readable text/u.test(errorText)
      ? "no-text"
      : /timed? ?out|aborted/iu.test(errorText)
        ? "timeout"
        : /no page at that address|\b404\b/u.test(errorText)
          ? "not-found"
          : "other";

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
      props: { tool: string; ms: number; ok: boolean; failure?: ToolFailure };
    }
  | {
      name: "signin";
      props:
        | ({ step: "started"; via: SignInVia } & Client)
        | { step: "expired" }
        | { step: "completed"; via: SignInVia; plan: string | null };
    }
  | {
      name: "feedback.given";
      props: { value: z.infer<typeof feedback> | null; reason?: z.infer<typeof reportReason> };
    }
  | { name: "api.failed"; props: { route: string; code: string } };

export function track({ name, props }: Event, owner?: string) {
  void db
    .insert(events)
    .values({
      id: Bun.randomUUIDv7(),
      name,
      owner,
      props,
    })
    .catch((err: Error) => {
      console.error(`event not saved: ${reasonOf(err)}`);
    });
}
