import { bulkCall } from "../plugins/bulkInput";
import type { Settings } from "../shared/settings";
import { yesChances } from "./clef";
import { type Call, spell } from "./confirm";

const ASK_AT = 0.3;
const ALLOW_AT = 0.6;
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
