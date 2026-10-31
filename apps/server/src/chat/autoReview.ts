import { bulkCall } from "../plugins/bulkInput";
import { z } from "zod";
import type { Settings } from "../shared/settings";
import { yesChances } from "./clef";
import { type Call, changesWhatIsTheirs, needsApproval, spell } from "./confirm";

const ASK_AT = 0.3;
const ALLOW_AT = 0.6;
const MONEY =
  /pay|refund|charge|transfer|purchase|checkout|invoice|donat|buy|money|wire|withdraw|deposit/iu;

const leavesInbox = z.object({
  labelIds: z.array(z.string()).refine((ids) => ids.includes("INBOX")),
});

const described = (call: Call) =>
  /unlabel/iu.test(call.toolName) && leavesInbox.safeParse(call.input).success
    ? `${spell(call)} (this archives the thread: it takes it out of the inbox)`
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
