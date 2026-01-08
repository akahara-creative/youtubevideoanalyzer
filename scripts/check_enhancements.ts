import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleEnhancements } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const enhancements = await db.select().from(seoArticleEnhancements).where(eq(seoArticleEnhancements.jobId, 93));

  if (enhancements.length > 0) {
    console.log(`Job 93 has ${enhancements.length} enhancements.`);
    console.log(`Enhanced Article Length: ${enhancements[0].enhancedArticle ? enhancements[0].enhancedArticle.length : 0}`);
  } else {
    console.log("Job 93 has NO enhancements.");
  }
  process.exit(0);
}

main().catch(console.error);
