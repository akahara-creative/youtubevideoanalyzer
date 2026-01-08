import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 92));
  const job = jobs[0];

  if (job) {
    console.log(`Job 92 Status: ${job.status}`);
    console.log(`Job 92 UpdatedAt: ${job.updatedAt}`);
    console.log(`Job 92 Article Length: ${job.article ? job.article.length : 0}`);
    console.log(`Job 92 Error Message: ${job.errorMessage}`);
  } else {
    console.log("Job 92 not found");
  }
  process.exit(0);
}

main().catch(console.error);
