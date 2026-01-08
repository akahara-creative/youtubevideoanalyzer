import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 96));
  const job = jobs[0];

  if (job) {
    console.log(`Job 96 Status: ${job.status}`);
    console.log(`Job 96 UpdatedAt: ${job.updatedAt}`);
    console.log(`Job 96 Error: ${job.errorMessage}`);
  } else {
    console.log("Job 96 not found");
  }
  process.exit(0);
}

main().catch(console.error);
