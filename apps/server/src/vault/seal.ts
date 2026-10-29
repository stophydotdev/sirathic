import { DecryptCommand, EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { env } from "@sirathic/env/server";

const kms = new KMSClient({
  region: env.VAULT_KMS_KEY_ARN.split(":")[3],
  credentials: {
    accessKeyId: env.VAULT_AWS_ACCESS_KEY_ID,
    secretAccessKey: env.VAULT_AWS_SECRET_ACCESS_KEY,
  },
});

const contextOf = (owner: string, site: string) => ({
  app: "sirathic-vault",
  env: env.RAILWAY_ENVIRONMENT_NAME,
  owner,
  site,
});

export const seal = async (plain: string, owner: string, site: string) => {
  const { CiphertextBlob } = await kms.send(
    new EncryptCommand({
      KeyId: env.VAULT_KMS_KEY_ARN,
      Plaintext: new TextEncoder().encode(plain),
      EncryptionContext: contextOf(owner, site),
    }),
  );
  if (!CiphertextBlob) throw new Error("KMS returned nothing to store");
  return Buffer.from(CiphertextBlob).toString("base64");
};

export const unseal = async (sealed: string, owner: string, site: string) => {
  const { Plaintext } = await kms.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(sealed, "base64"),
      EncryptionContext: contextOf(owner, site),
    }),
  );
  if (!Plaintext) throw new Error("KMS returned nothing to open");
  return new TextDecoder().decode(Plaintext);
};
