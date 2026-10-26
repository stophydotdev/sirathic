export const PROJECT_NAME_MAX = 50;

export const containsLink = (text: string) =>
  /https?:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}\b/i.test(text);

export const PROJECT_ICONS = [
  "book",
  "book2",
  "mosque",
  "pray",
  "moon",
  "sun",
  "star",
  "heart",
  "leaf",
  "plant",
  "flame",
  "bulb",
  "school",
  "language",
  "scale",
  "users",
  "home",
  "briefcase",
  "coin",
  "calendar",
  "compass",
  "map",
  "world",
  "plane",
  "code",
  "flask",
  "palette",
  "sparkles",
] as const;

export const BOT_COLORS = [
  "white",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
  "gray",
] as const;

export const SECTION_NAME_MAX = 40;

export const BOT_ICONS = [
  "man",
  "woman",
  "imam",
  "scholar",
  "boy",
  "girl",
  "grandfather",
  "grandmother",
  "mosque",
  "crescent",
  "lantern",
  "quran",
  "tasbih",
  "kaaba",
  "minaret",
  "prayerMat",
  "dates",
  "star",
  "dua",
  "dome",
] as const;

export const NOTE_MAX = 600;

export const REVIEW_EVERY = 10;
