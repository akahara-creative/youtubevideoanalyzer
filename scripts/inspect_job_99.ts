import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 99));
  
  if (job.length > 0) {
    console.log(`Job 99 Status: ${job[0].status}`);
    console.log(`Job 99 UpdatedAt: ${job[0].updatedAt}`);
    console.log(`Job 99 Error: ${job[0].errorMessage}`);
    console.log(`Job 99 Article Length: ${job[0].article?.length || 0}`);
  } else {
    console.log("Job 99 not found");
  }

  process.exit(0);
}

main().catch(console.error);
