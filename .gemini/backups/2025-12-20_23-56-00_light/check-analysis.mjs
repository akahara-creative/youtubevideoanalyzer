import { drizzle } from "drizzle-orm/mysql2";
import { videoAnalyses } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL);

const results = await db.select().from(videoAnalyses).where(eq(videoAnalyses.id, 240001));

console.log(JSON.stringify(results[0], null, 2));
