import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 95));
  const job = jobs[0];

  if (job) {
    console.log(`Job 95 Status: ${job.status}`);
    console.log(`Job 95 Article Length: ${job.article ? job.article.length : 0}`);
  }
  process.exit(0);
}

main().catch(console.error);
