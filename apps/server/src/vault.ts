import { env } from "@sirathic/env/server";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";

export const seal = (data: string) => symmetricEncrypt({ key: env.BETTER_AUTH_SECRET, data });

export const unseal = (data: string) => symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data });
