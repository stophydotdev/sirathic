import { z } from "zod";

const issuedBy = {
  issuer: z.string().optional(),
  authorization_server: z.string().optional(),
  token_endpoint: z.string().optional(),
};

export const storedSecrets = z.object({
  client: z
    .object({
      client_id: z.string(),
      client_secret: z.string().optional(),
      client_id_issued_at: z.number().optional(),
      client_secret_expires_at: z.number().optional(),
      ...issuedBy,
    })
    .optional(),
  tokens: z
    .object({
      access_token: z.string(),
      id_token: z.string().optional(),
      token_type: z.string(),
      expires_in: z.number().optional(),
      scope: z.string().optional(),
      refresh_token: z.string().optional(),
      ...issuedBy,
    })
    .optional(),
  verifier: z.string().optional(),
  state: z.string().optional(),
  returnTo: z.string().optional(),
});

export type Secrets = z.infer<typeof storedSecrets>;

export const FORGET = {
  all: { client: undefined, tokens: undefined, verifier: undefined, state: undefined },
  client: { client: undefined },
  tokens: { tokens: undefined },
  verifier: { verifier: undefined },
} satisfies Record<string, Partial<Secrets>>;

export const withUpdate = (secrets: Secrets, update: Partial<Secrets>) => {
  const merged = { ...secrets, ...update };
  return { secrets: merged, connected: merged.tokens !== undefined };
};
