import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 74));
  const job = jobs[0];

  if (job) {
    console.log(`Job 74 Status: ${job.status}`);
    console.log(`Job 74 Progress: ${job.progress}%`);
    console.log(`Job 74 Log: ${job.log ? job.log.slice(-200) : 'No log'}`);
  } else {
    console.log('Job 74 not found');
  }
}

main();
