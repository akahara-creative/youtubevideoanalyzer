import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 97));
  const job = jobs[0];

  if (job) {
    console.log(`Job 97 Status: ${job.status}`);
    console.log(`Job 97 UpdatedAt: ${job.updatedAt}`);
    console.log(`Job 97 Article Length: ${job.article ? job.article.length : 0}`);
    
    // Check if it's been updated in the last minute
    const now = new Date();
    const diff = now.getTime() - new Date(job.updatedAt).getTime();
    console.log(`Last Update: ${diff / 1000} seconds ago`);
  }
  process.exit(0);
}

main().catch(console.error);
