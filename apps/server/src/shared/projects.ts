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
