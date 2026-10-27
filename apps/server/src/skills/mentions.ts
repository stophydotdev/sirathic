const letterOrDigit = /[\p{L}\p{N}]/u;
const emailCharacter = /[\p{L}\p{N}._%+-]/u;

export function mentionedSkills<Skill extends { name: string }>(
  text: string,
  all: readonly Skill[],
) {
  const lower = text.toLowerCase();
  const byLength = all
    .map((skill) => ({ skill, name: skill.name.toLowerCase() }))
    .toSorted((a, b) => b.name.length - a.name.length);
  const found = new Set<Skill>();
  for (let at = lower.indexOf("@"); at !== -1; at = lower.indexOf("@", at + 1)) {
    if (emailCharacter.test(lower[at - 1] ?? "")) continue;
    const rest = lower.slice(at + 1);
    const match = byLength.find(
      ({ name }) => rest.startsWith(name) && !letterOrDigit.test(rest[name.length] ?? ""),
    );
    if (match) found.add(match.skill);
  }
  return [...found];
}
