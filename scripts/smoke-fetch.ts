import { fetchUrl } from "../packages/core/src/tools/webFetch"

const defaults = [
  "https://quran.com/2/183",
  "https://sunnah.com/bukhari:1",
  "https://dorar.net/hadith/sharh/1",
]

const urls = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaults

let failures = 0

for (const url of urls) {
  const started = Date.now()
  const res = await fetchUrl({ url })
  const ms = Date.now() - started

  if (!res.ok) {
    failures++
    const status = res.status ? ` (${res.status})` : ""
    console.log(`FAIL ${url}`)
    console.log(`     ${res.reason}${status} ${res.message ?? ""} · ${ms}ms`)
    continue
  }

  console.log(`OK   ${url}  [${res.crawlMode}] ${ms}ms`)
  console.log(`     ${res.title}`)
  console.log(`     lang=${res.lang ?? "?"} bytes=${res.byteSize} hash=${res.contentHash.slice(0, 12)}`)
}

process.exit(failures > 0 ? 1 : 0)
