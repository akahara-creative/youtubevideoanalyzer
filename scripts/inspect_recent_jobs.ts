import "dotenv/config";
import { desc } from "drizzle-orm";
import { getDb } from "../server/db";
import { seoArticleJobs } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) return;

  console.log("Inspecting last 5 jobs...");
  const jobs = await db.select().from(seoArticleJobs).orderBy(desc(seoArticleJobs.id)).limit(5);
  
  for (const job of jobs) {
    console.log(`ID: ${job.id}, Status: ${job.status}, CreatedAt: ${job.createdAt}, Progress: ${job.progress}%`);
  }

  process.exit(0);
}

main().catch(console.error);
