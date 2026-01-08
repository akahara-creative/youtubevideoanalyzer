
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

  const result = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 104));
  
  if (result.length > 0) {
    const job = result[0];
    console.log("Job 104 Status:");
    console.log(`Status: ${job.status}`);
    console.log(`Progress: ${job.progress}`);
    console.log(`Step: ${job.currentStep}`);
    console.log(`Error: ${job.errorMessage}`);
    console.log(`Updated At: ${job.updatedAt}`);
  } else {
    console.log("Job 104 not found");
  }
  process.exit(0);
}

main().catch(console.error);
