export const PROJECT_NAME_MAX = 50;

export const containsLink = (text: string) =>
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|ai|dev|app|co|me|info|xyz)\b/i.test(text);

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

export const BOT_BODIES = [
  "circle",
  "pebble",
  "squircle",
  "capsule",
  "triangle",
  "hexagon",
  "cloud",
  "drop",
] as const;

export const NOTE_MAX = 600;

export const REVIEW_EVERY = 10;
