import { tool } from "ai";
import { settingChange } from "../shared/cards";
import { updateSettings } from "./settings";

export const settingTools = (owner: string) => ({
  change_setting: tool({
    description:
      'Changes the user\'s Sirathic settings: madhab (the school you answer by first), name (what you call them) or about (what they told you about themselves). When the user asks to change one, like "answer me by the Hanafi school" or "call me Yusuf", change it with this tool instead of telling them how to do it in Settings. When they only mention one in passing, offer to change it first. After a change, confirm it in one short sentence, without listing how rulings differ, and answer by the new setting from then on.',
    inputSchema: settingChange,
    execute: async (change) => {
      await updateSettings(owner, change);
      return change;
    },
  }),
});
