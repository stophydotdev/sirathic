import { bulkCall } from "../plugins/bulkInput";
import { toolName } from "../plugins/catalog";
import { outgoingEmail } from "../plugins/outgoingEmail";
import { z } from "zod";
import type { Settings } from "../shared/settings";
import { yesChances } from "./clef";
import { type Call, CHANGES, changesWhatIsTheirs, needsApproval, spell } from "./confirm";

const ASK_AT = 0.3;
const ALLOW_AT = 0.6;
const MONEY =
  /pay|refund|charge|transfer|purchase|checkout|invoice|donat|buy|money|wire|withdraw|deposit/iu;

const inboxIds = z.array(z.string()).refine((ids) => ids.includes("INBOX"));

const leavesInbox = z.union([
  z.object({ labelIds: inboxIds }),
  z.object({ removeLabelIds: inboxIds }),
]);

const described = (call: Call) =>
  /unlabel|update[^a-z]+message[^a-z]+labels/iu.test(call.toolName) &&
  leavesInbox.safeParse(call.input).success
    ? `${spell(call)} (this archives it: it takes it out of the inbox)`
    : spell(call);

const chancesFor = async (action: string, rules: Settings["rules"]) => {
  const chance = await yesChances(
    `The assistant is about to run the tool ${action.replaceAll("_", " ")}.`,
    Object.fromEntries(
      rules.map(({ text }, index) => [
        `rule${index}`,
        `The user's rule: "${text}". Is the tool call something this rule is about?`,
      ]),
    ),
    "clef",
  );
  return (index: number) => chance(`rule${index}`);
};

export const asksFirst = async (call: Call, rules: Settings["rules"]) => {
  const action = spell(call);
  if (bulkCall(call) || !rules.some(({ effect }) => effect === "allow") || MONEY.test(action)) {
    return true;
  }
  try {
    const score = await chancesFor(described(call), rules);
    const asks = rules.some(
      ({ effect }, index) => effect === "ask" && (score(index) ?? 1) >= ASK_AT,
    );
    const allows = rules.some(
      ({ effect }, index) => effect === "allow" && (score(index) ?? 0) >= ALLOW_AT,
    );
    return asks || !allows;
  } catch (err) {
    console.warn(`auto-review failed: ${err instanceof Error ? err.message : String(err)}`);
    return true;
  }
};

const askedByRule = async (call: Call, rules: Settings["rules"]) => {
  const asking = rules.filter(({ effect }) => effect === "ask");
  if (asking.length === 0) return false;
  try {
    const score = await chancesFor(described(call), asking);
    return asking.some((_, index) => (score(index) ?? 1) >= ASK_AT);
  } catch (err) {
    console.warn(`auto-review failed: ${err instanceof Error ? err.message : String(err)}`);
    return true;
  }
};

export const needsCard = async (
  call: Call,
  writes: ReadonlySet<string>,
  rules: Settings["rules"],
) =>
  needsApproval(call, writes)
    ? asksFirst(call, rules)
    : changesWhatIsTheirs(call, writes) && (await askedByRule(call, rules));

const GMAIL_SEND = toolName("gmail", "send_email");

const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gu;

const DRAFT = /(?:^|[^a-z])(?:create|update)[^a-z]+draft(?=$|[^a-z])/iu;

const DESTROYS = /(?:^|[^a-z])(?:delete|remove|destroy|erase|empty|purge|wipe)(?=$|[^a-z])/iu;

const NOTIFIES = /send.?(?:updates|notifications)|notif/iu;

const NO_GUESTS = new Set([
  "calendarid",
  "summary",
  "description",
  "location",
  "title",
  "icaluid",
  "organizer",
  "creator",
]);

const ADDRESS_BREAK = /[\s"'<>,;:()[\]{}\\]+/u;

const verbs = z
  .object({
    action: z.string().catch(""),
    command: z.string().catch(""),
    method: z.string().catch(""),
  })
  .catch({ action: "", command: "", method: "" });

export const addressesIn = (text: string) =>
  (text.match(ADDRESS) ?? []).map((address) => address.toLowerCase());

const UNATTENDED_REFUSAL =
  "Refused: this run happens while the user is away, so besides reading it can only label, archive, write drafts and add calendar events that invite or notify no one outside the routine. The only email it can send goes to an address written in the routine itself or to the user. Don't try another way. Say in your result what you would have done, so the user can ask you to do it.";

const destroys = (call: Call) => {
  const { action, command, method } = verbs.parse(call.input);
  return DESTROYS.test(
    [call.toolName, action, command, method].join(" ").replaceAll(/(\p{Ll})(\p{Lu})/gu, "$1 $2"),
  );
};

const invitesOnly = (call: Call, allowed: ReadonlySet<string>) => {
  let notifies = false;
  const reaches = JSON.stringify(call.input ?? null, (key, value) => {
    if (NOTIFIES.test(key) && value !== "none" && value !== false) notifies = true;
    return NO_GUESTS.has(key.toLowerCase().replaceAll(/[^a-z]/gu, "")) ? undefined : value;
  });
  return (
    !notifies &&
    reaches
      .split(ADDRESS_BREAK)
      .filter((piece) => piece.includes("@"))
      .every((piece) => allowed.has(piece.toLowerCase()))
  );
};

const safeChange = (call: Call, allowed: ReadonlySet<string>) =>
  !destroys(call) &&
  (DRAFT.test(call.toolName) || (CHANGES.test(call.toolName) && invitesOnly(call, allowed)));

const runsAlone = (call: Call, writes: ReadonlySet<string>, allowed: ReadonlySet<string>) =>
  !needsApproval(call, writes) && (!writes.has(call.toolName) || safeChange(call, allowed));

const unattendedApproval = (
  call: Call,
  writes: ReadonlySet<string>,
  sendsOnlyTo: readonly string[],
) => {
  const allowed = new Set(sendsOnlyTo.map((address) => address.toLowerCase()));
  if (runsAlone(call, writes, allowed)) return undefined;
  const email = call.toolName === GMAIL_SEND ? outgoingEmail.safeParse(call.input).data : undefined;
  const named =
    email !== undefined &&
    [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])].every((address) =>
      allowed.has(address.toLowerCase()),
    );
  return named ? undefined : { type: "denied" as const, reason: UNATTENDED_REFUSAL };
};

export const approvalFor = async (
  call: Call,
  writes: ReadonlySet<string>,
  rules: Settings["rules"],
  sendsOnlyTo: readonly string[] | undefined,
) =>
  sendsOnlyTo
    ? unattendedApproval(call, writes, sendsOnlyTo)
    : (await needsCard(call, writes, rules))
      ? ("user-approval" as const)
      : undefined;
