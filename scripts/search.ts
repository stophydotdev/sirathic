import { webSearch } from "../lib/webSearch";

const query = process.argv[2];
const limit = process.argv[3] ? Number(process.argv[3]) : undefined;

if (!query) {
  console.error('usage: bun run search "<query>" [limit]');
  process.exit(1);
}

const start = performance.now();
const results = await webSearch(query, { limit });
const elapsed = ((performance.now() - start) / 1000).toFixed(2);

if (results.length === 0) {
  console.log("no results");
  process.exit(0);
}

results.forEach((r, i) => {
  console.log(`\n${i + 1}. ${r.title}`);
  console.log(`   ${r.url}`);
  if (r.description) console.log(`   ${r.description}`);
});

console.log(`\n${results.length} results in ${elapsed}s`);
