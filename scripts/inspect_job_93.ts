import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 93));
  const job = jobs[0];

  if (job) {
    console.log(`Job 93 Status: ${job.status}`);
    console.log(`Job 93 UpdatedAt: ${job.updatedAt}`);
    console.log(`Job 93 Article Length: ${job.article ? job.article.length : 0}`);
  } else {
    console.log("Job 93 not found");
  }
  process.exit(0);
}

main().catch(console.error);
