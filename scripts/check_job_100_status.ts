import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  const job = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 100));
  
  if (job.length > 0) {
    console.log(`Job #100 Status: ${job[0].status}`);
    console.log(`Progress: ${job[0].progress}%`);
    console.log(`Detail: ${job[0].progressDetail}`);
    console.log(`Current Step: ${job[0].currentStep}`);
  } else {
    console.log("Job #100 not found");
  }

  process.exit(0);
}

main().catch(console.error);
