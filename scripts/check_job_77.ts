import 'dotenv/config';
import { getDb } from '../server/db';
import { seoArticleJobs } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) return;

  const jobs = await db.select().from(seoArticleJobs).where(eq(seoArticleJobs.id, 77));
  const job = jobs[0];

  if (job) {
    console.log(`Job 77 Status: ${job.status}`);
    console.log(`Job 77 Progress: ${job.progress}%`);
    console.log(`Job 77 Log (Last 200 chars): ${job.log ? job.log.slice(-200) : 'No log'}`);
  } else {
    console.log('Job 77 not found');
  }
}

main();
