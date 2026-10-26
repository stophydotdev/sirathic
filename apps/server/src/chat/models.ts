import { countUp } from "@sirathic/core/cache";
import { chatModel, DEFAULT_MODEL } from "../chatgpt/codex";
import { DEFAULT_NOOR, NOOR_SIDE_MODEL, noorModel } from "../noor";
import { reasonOf, StatusError } from "../respond";
import type { User } from "../users";

const NOOR_DAILY_ANSWERS = 30;
const NOOR_COUNT_KEEP_SECONDS = 2 * 24 * 60 * 60;

export function pickModels(user: User, requested: string | undefined) {
  const modelName = requested ?? (user.via === "chatgpt" ? DEFAULT_MODEL : DEFAULT_NOOR);
  const chosen =
    noorModel(modelName) ?? (user.via === "chatgpt" ? chatModel(user, modelName) : undefined);
  const small = user.via === "chatgpt" ? chatModel(user) : NOOR_SIDE_MODEL;
  if (!chosen) {
    throw new StatusError(403, "sign in with ChatGPT to use this model");
  }
  return { modelName, models: { model: chosen, small } };
}

export async function countNoorAnswer(by: string, modelName: string) {
  if (!noorModel(modelName)) return;
  const day = new Date().toISOString().slice(0, 10);
  const used = await countUp(`noor-answers:${by}:${day}`, NOOR_COUNT_KEEP_SECONDS).catch(
    (err: Error) => {
      console.error(`noor answers not counted: ${reasonOf(err)}`);
      return 0;
    },
  );
  if (used > NOOR_DAILY_ANSWERS) {
    throw new StatusError(
      429,
      `You've used today's ${NOOR_DAILY_ANSWERS} Noor answers. They come back tomorrow.`,
    );
  }
}
