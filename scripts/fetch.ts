import { webFetch } from "@sirathic/core/webFetch";

const url = process.argv[2];

if (!url) {
  console.error('usage: bun run fetch "<url>"');
  process.exit(1);
}

const start = performance.now();
const page = await webFetch(url);
const elapsed = ((performance.now() - start) / 1000).toFixed(2);

console.log(`# ${page.title}`);
console.log(
  `# ${page.url} (status ${page.statusCode ?? "?"}, ${page.markdown.length} chars, ${elapsed}s)`,
);
console.log();
console.log(page.markdown);
