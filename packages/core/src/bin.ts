import { askStream } from "./ask"

const question = process.argv.slice(2).join(" ").trim()
if (!question) {
  console.error('usage: bun run ask "your question"')
  process.exit(1)
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

const started = Date.now()
const { sources, stream } = await askStream(question)

process.stdout.write(dim(`Sources (${Date.now() - started}ms):\n`))
for (const s of sources) {
  process.stdout.write(dim(`  [${s.index}] ${s.label} — ${s.url}\n`))
}
process.stdout.write("\n")

for await (const part of stream.fullStream) {
  if (part.type === "text-delta") process.stdout.write(part.text)
  else if (part.type === "error") process.stderr.write(`\nerror: ${String(part.error)}\n`)
}

process.stdout.write("\n")
