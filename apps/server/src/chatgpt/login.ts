import { z } from "zod";
import {
  codexFetch,
  DEVICE_PAGE,
  identityOf,
  pollDeviceLogin,
  startDeviceLogin,
} from "./device";

const models = z.object({ models: z.array(z.object({ slug: z.string() })) });
const delta = z.object({
  type: z.literal("response.output_text.delta"),
  delta: z.string(),
});

const login = await startDeviceLogin();
console.log(`Open ${DEVICE_PAGE} and enter ${login.userCode}`);

const waitForSignIn = async (): ReturnType<typeof pollDeviceLogin> => {
  const polled = await pollDeviceLogin(login);
  if (polled.status !== "pending") return polled;
  await Bun.sleep(login.intervalMs);
  return waitForSignIn();
};

const result = await waitForSignIn();
if (result.status !== "signed-in") {
  console.log("The code expired before it was entered.");
  process.exit(1);
}

const { tokens } = result;
const identity = await identityOf(tokens);
console.log(
  `Signed in as ${identity.email ?? identity.subject} (${identity.plan ?? "unknown plan"})`,
);

const codex = codexFetch(async () => ({
  accessToken: tokens.accessToken,
  accountId: identity.accountId,
}));
const listed = models.parse(await (await codex("models")).json());
const slugs = listed.models.map((model) => model.slug);
console.log(`Models on this plan: ${slugs.join(", ")}`);

const model = slugs.includes("gpt-6-luna") ? "gpt-6-luna" : slugs[0];
if (!model) process.exit(1);
const response = await codex("responses", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model,
    instructions: "You are Sirathic, an Islamic answering engine. Be brief.",
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: "Reply with one short line of salam." },
        ],
      },
    ],
    store: false,
    stream: true,
    reasoning: { effort: "low", summary: "auto" },
    include: ["reasoning.encrypted_content"],
  }),
});
if (!response.ok || !response.body) {
  console.log(
    `The model call failed (${response.status}): ${await response.text()}`,
  );
  process.exit(1);
}
let text = "";
for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
  for (const line of chunk.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const event = delta.safeParse(JSON.parse(line.slice(6)));
    if (event.success) text += event.data.delta;
  }
}
console.log(`${model} says: ${text}`);
