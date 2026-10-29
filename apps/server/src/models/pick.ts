import { chatModel, DEFAULT_MODEL } from "./subscription";
import { DEFAULT_NOOR, NOOR_SIDE_MODEL, noorModel } from "./noor";
import { planModel } from "./plans";
import { StatusError } from "../http";
import type { User } from "../account/users";

export function pickModels(user: User, requested: string | undefined) {
  const modelName = requested ?? (user.via === "chatgpt" ? DEFAULT_MODEL : DEFAULT_NOOR);
  const chosen =
    noorModel(modelName) ??
    planModel(user.id, modelName) ??
    (user.via === "chatgpt" ? chatModel(user, modelName) : undefined);
  const small = user.via === "chatgpt" ? chatModel(user) : NOOR_SIDE_MODEL;
  if (!chosen) {
    throw new StatusError(403, "sign in with ChatGPT to use this model");
  }
  return { modelName, models: { model: chosen, small } };
}
