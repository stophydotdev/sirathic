export type MentionTarget = { name: string; url?: string };

export type MentionPart<Target extends MentionTarget = MentionTarget> =
  | { kind: "text"; value: string }
  | { kind: "mention"; value: string; target: Target };

const letterOrDigit = /[\p{L}\p{N}]/u;
const emailCharacter = /[\p{L}\p{N}._%+-]/u;

export function splitMentions<Target extends MentionTarget>(
  text: string,
  targets: readonly Target[],
): MentionPart<Target>[] {
  const byLength = targets.toSorted((a, b) => b.name.length - a.name.length);
  const parts: MentionPart<Target>[] = [];
  let cursor = 0;
  for (let at = text.indexOf("@"); at !== -1; at = text.indexOf("@", at + 1)) {
    if (at < cursor || emailCharacter.test(text[at - 1] ?? "")) continue;
    const rest = text.slice(at + 1);
    const target = byLength.find(
      ({ name }) =>
        rest.slice(0, name.length).toLowerCase() === name.toLowerCase() &&
        !letterOrDigit.test(rest[name.length] ?? ""),
    );
    if (!target) continue;
    if (at > cursor) parts.push({ kind: "text", value: text.slice(cursor, at) });
    cursor = at + 1 + target.name.length;
    parts.push({ kind: "mention", value: text.slice(at, cursor), target });
  }
  if (cursor < text.length) parts.push({ kind: "text", value: text.slice(cursor) });
  return parts;
}
