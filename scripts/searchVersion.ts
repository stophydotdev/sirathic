import { bumpDataVersion } from "@sirathic/core/cache";

console.log(`Search cache version is now ${await bumpDataVersion()}`);
process.exit(0);
