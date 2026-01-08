
import * as dotenv from 'dotenv';
dotenv.config();
import { getDb } from "../server/db.ts";
import { seoArticleJobs } from "../drizzle/schema.ts";
import { eq, inArray } from "drizzle-orm";
import fs from 'fs';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    return;
  }

  const jobs = await db.select().from(seoArticleJobs).where(inArray(seoArticleJobs.id, [92, 107]));
  
  const job92 = jobs.find(j => j.id === 92);
  const job107 = jobs.find(j => j.id === 107);

  if (!job92) console.log("Job 92 not found");
  if (!job107) console.log("Job 107 not found");

  if (job92) {
    console.log("=== Job 92 ===");
    console.log(`Theme: ${job92.theme}`);
    console.log(`Structure Length: ${job92.structure?.length}`);
    console.log(`Article Length: ${job92.article?.length}`);
    fs.writeFileSync('job_92_structure.json', job92.structure || '');
    fs.writeFileSync('job_92_article.md', job92.article || '');
  }

  if (job107) {
    console.log("=== Job 107 ===");
    console.log(`Theme: ${job107.theme}`);
    console.log(`Structure Length: ${job107.structure?.length}`);
    console.log(`Article Length: ${job107.article?.length}`);
    fs.writeFileSync('job_107_structure.json', job107.structure || '');
    fs.writeFileSync('job_107_article.md', job107.article || '');
  }

  process.exit(0);
}

main().catch(console.error);
