
import 'dotenv/config';
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { processSeoArticleJob } from "../server/seoArticleJobProcessor";

async function debugJob114() {
  console.log("Debugging Job 114...");
  const db = await getDb();
  
  // Reset to pending
  await db.update(seoArticleJobs)
    .set({ status: 'pending', errorMessage: null })
    .where(eq(seoArticleJobs.id, 114));
    
  console.log("Reset Job 114 to pending.");

  try {
    console.log("Calling processSeoArticleJob(114)...");
    await processSeoArticleJob(114);
    console.log("Job 114 completed successfully.");
  } catch (error) {
    console.error("Job 114 failed with error:");
    console.error(error);
  }
  process.exit(0);
}

debugJob114();
