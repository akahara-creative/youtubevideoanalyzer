
import * as dotenv from 'dotenv';
dotenv.config();
import { getDb } from "../server/db.ts";
import { seoArticleJobs } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    return;
  }

  const result = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 92));
  
  if (result.length > 0) {
    const job = result[0];
    console.log("Job 92 Details:");
    console.log(`Status: ${job.status}`);
    console.log(`Created At: ${job.createdAt}`);
    console.log(`Completed At: ${job.completedAt}`);
    console.log(`Updated At: ${job.updatedAt}`);
    
    if (job.createdAt && job.completedAt) {
      const duration = (new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000 / 60; // minutes
      console.log(`Total Duration: ${duration.toFixed(2)} minutes (${(duration/60).toFixed(2)} hours)`);
    }
  } else {
    console.log("Job 92 not found");
  }
  process.exit(0);
}

main().catch(console.error);
