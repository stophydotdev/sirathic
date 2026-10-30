import { BROWSER_TOOLS } from "../../bots/browser";
import type { Skill } from "./builtIn";
import hajjUmrah from "./hajjUmrah.md" with { type: "text" };
import halalFood from "./halalFood.md" with { type: "text" };
import halalInvesting from "./halalInvesting.md" with { type: "text" };
import masjid from "./masjid.md" with { type: "text" };
import qurbani from "./qurbani.md" with { type: "text" };
import quranPlan from "./quranPlan.md" with { type: "text" };
import ramadan from "./ramadan.md" with { type: "text" };
import wasiyyah from "./wasiyyah.md" with { type: "text" };
import zakatGiving from "./zakatGiving.md" with { type: "text" };

const STOPHY_TOOLS = ["stophy_search_endpoints", "stophy_call"];

export const muslimSkills: Skill[] = [
  {
    name: "halal_food",
    when: "Load when the user asks whether a restaurant, takeaway, product or ingredient is halal, or wants halal places to eat",
    text: halalFood,
    tools: STOPHY_TOOLS,
  },
  {
    name: "masjid",
    when: "Load when the user wants a masjid nearby, a masjid's prayer or Jumu'ah times, or Jumu'ah in their calendar",
    text: masjid,
    tools: [...STOPHY_TOOLS, ...BROWSER_TOOLS],
  },
  {
    name: "hajj_umrah",
    when: "Load when the user plans, books or asks how to do Hajj or Umrah, or wants a Nusuk permit like a Rawdah slot",
    text: hajjUmrah,
    tools: BROWSER_TOOLS,
  },
  {
    name: "ramadan",
    when: "Load when the user asks about suhoor or iftar times, a Ramadan timetable or reminders, missed fasts, the last ten nights or zakat al-fitr",
    text: ramadan,
  },
  {
    name: "qurbani",
    when: "Load when the user wants to order or compare a qurbani (udhiyah) or an aqiqah",
    text: qurbani,
    tools: BROWSER_TOOLS,
  },
  {
    name: "zakat_giving",
    when: "Load when the user wants their zakat worked out from their own money, or wants to give zakat or sadaqah to a charity",
    text: zakatGiving,
    tools: BROWSER_TOOLS,
  },
  {
    name: "quran_plan",
    when: "Load when the user wants a daily Quran reading or memorization plan, to finish the Quran by a date, or asks where they are up to",
    text: quranPlan,
  },
  {
    name: "wasiyyah",
    when: "Load when the user wants an Islamic will drafted or asks how their estate would be split between their heirs",
    text: wasiyyah,
  },
  {
    name: "halal_investing",
    when: "Load when the user asks whether a stock, fund, pension, mortgage or other investment is halal or Shariah-compliant",
    text: halalInvesting,
  },
];
