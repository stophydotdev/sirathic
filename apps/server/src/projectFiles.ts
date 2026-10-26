export const FILE_CHARS = 20_000;
export const TOTAL_CHARS = 60_000;

export const projectFilesRules = (files: readonly { name: string; text: string }[]) => {
  let left = TOTAL_CHARS;
  const blocks: string[] = [];
  for (const file of files) {
    if (left <= 0) break;
    const limit = Math.min(FILE_CHARS, left);
    const cut = file.text.length > limit;
    const text = cut
      ? `${file.text.slice(0, limit)}\n[Cut: the file is longer than this.]`
      : file.text;
    left -= Math.min(file.text.length, limit);
    blocks.push(
      `<project_file name="${file.name.replaceAll('"', "'")}">\n${text}\n</project_file>`,
    );
  }
  return blocks.length > 0
    ? `\n\nThe project has these files. Use them when they help and cite them by name:\n${blocks.join("\n")}`
    : "";
};
