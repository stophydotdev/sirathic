import { bulkCall } from "../plugins/bulkInput";
import type { Settings } from "../shared/settings";
import { yesChances } from "./clef";
import { type Call, changesWhatIsTheirs, needsApproval, spell } from "./confirm";

const ASK_AT = 0.3;
const ALLOW_AT = 0.6;
const RULE_AT = 0.3;
const MONEY =
  /pay|refund|charge|transfer|purchase|checkout|invoice|donat|buy|money|wire|withdraw|deposit/iu;

export const asksFirst = async (call: Call, rules: Settings["rules"]) => {
  const action = spell(call);
  if (bulkCall(call) || !rules.some(({ effect }) => effect === "allow") || MONEY.test(action)) {
    return true;
  }
  try {
    const chance = await yesChances(
      `Tool call: ${action.replaceAll("_", " ")}`,
      Object.fromEntries(
        rules.map(({ text }, index) => [
          `rule${index}`,
          `Rule: "${text}". Is this tool call an example of what the rule describes?`,
        ]),
      ),
    );
    const score = (index: number) => chance(`rule${index}`);
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
    const chance = await yesChances(
      `The assistant is about to run the tool ${spell(call).replaceAll("_", " ")}.`,
      Object.fromEntries(
        asking.map(({ text }, index) => [
          `rule${index}`,
          `The user's rule: "${text}". Is the tool call something this rule is about?`,
        ]),
      ),
      "clef",
    );
    return asking.some((_, index) => (chance(`rule${index}`) ?? 1) >= RULE_AT);
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
