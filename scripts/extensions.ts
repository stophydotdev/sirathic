import { db } from "@sirathic/db";
import { sql } from "drizzle-orm";

await db.execute(sql`create extension if not exists vector`);
await db.$client.end();
