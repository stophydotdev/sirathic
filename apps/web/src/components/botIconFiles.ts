import type { BOT_ICONS } from "@sirathic/server/projects";

type BotIcon = (typeof BOT_ICONS)[number];

export const BOT_ICON_FILES = {
  man: {
    src: "/bot-icons/man.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/muslim_15387278",
  },
  woman: {
    src: "/bot-icons/woman.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/muslim_15387063",
  },
  imam: {
    src: "/bot-icons/imam.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/imam_10194897",
  },
  scholar: {
    src: "/bot-icons/scholar.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/imam_15387214",
  },
  boy: {
    src: "/bot-icons/boy.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/boy_10346272",
  },
  girl: {
    src: "/bot-icons/girl.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/hijab_10346274",
  },
  grandfather: {
    src: "/bot-icons/grandfather.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/imam_10194898",
  },
  grandmother: {
    src: "/bot-icons/grandmother.png",
    author: "Aranagraphics",
    page: "https://www.flaticon.com/free-icon/muslim_10259569",
  },
  mosque: {
    src: "/bot-icons/mosque.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/mosque_15576693",
  },
  crescent: {
    src: "/bot-icons/crescent.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/crescent-moon_15576569",
  },
  lantern: {
    src: "/bot-icons/lantern.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/lantern_15576674",
  },
  quran: {
    src: "/bot-icons/quran.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/quran_15576733",
  },
  tasbih: {
    src: "/bot-icons/tasbih.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/tasbih_15576758",
  },
  kaaba: {
    src: "/bot-icons/kaaba.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/kaaba_15576664",
  },
  minaret: {
    src: "/bot-icons/minaret.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/azan-tower_15576538",
  },
  prayerMat: {
    src: "/bot-icons/prayerMat.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/prayer-mat_15576723",
  },
  dates: {
    src: "/bot-icons/dates.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/date-palm_15576574",
  },
  star: {
    src: "/bot-icons/star.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/rub-el-hizb_15576654",
  },
  dua: {
    src: "/bot-icons/dua.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/prayer_15576659",
  },
  dome: {
    src: "/bot-icons/dome.png",
    author: "khulqi Rosyid",
    page: "https://www.flaticon.com/free-icon/dome-mosque_15576583",
  },
} as const satisfies Record<BotIcon, { src: string; author: string; page: string }>;
